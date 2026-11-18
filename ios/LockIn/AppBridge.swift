import AVFoundation
import Foundation
import MapKit
import Speech
import SwiftUI
import UIKit
import UserNotifications
import WebKit

// Native pieces the page asks for through the "app" message handler (see src/js/22-native.js):
//   {op: "map", places: [{name, city, lat, lon, count}], focus: "name"} -> shows the gyms in Apple Maps
//   {op: "remind", on: true, deadline: <ms since 1970>, days: 23}   -> schedules streak reminders
//   {op: "listen"} / {op: "listenStop"}                               -> speech to text; words arrive through window.__speech
final class AppBridge: NSObject, WKScriptMessageHandlerWithReply {
    static let handlerName = "app"

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let op = body["op"] as? String else {
            replyHandler(nil, "bad_request"); return
        }
        switch op {
        case "map":
            let places = (body["places"] as? [[String: Any]] ?? []).compactMap(GymPlace.init)
            guard !places.isEmpty, let host = Self.topViewController() else { replyHandler(false, nil); return }
            let focus = body["focus"] as? String
            let view = GymMapView(places: places, focus: places.first { $0.name == focus } ?? places[0]) {
                host.presentedViewController?.dismiss(animated: true)
            }
            let vc = UIHostingController(rootView: view)
            vc.modalPresentationStyle = .pageSheet
            if let sheet = vc.sheetPresentationController { sheet.detents = [.large()]; sheet.prefersGrabberVisible = true }
            host.present(vc, animated: true)
            replyHandler(true, nil)
        case "remind":
            let on = body["on"] as? Bool ?? false
            let deadline = (body["deadline"] as? Double).map { Date(timeIntervalSince1970: $0 / 1000) }
            let days = body["days"] as? Int ?? 0
            Reminders.schedule(on: on, deadline: deadline, days: days) { granted in replyHandler(granted, nil) }
        case "listen":
            SpeechInput.shared.start(web: message.webView) { err in replyHandler(err == nil, err) }
        case "gymHere":
            GymWatcher.shared.here { loc in replyHandler(loc.map { ["lat": $0.coordinate.latitude, "lon": $0.coordinate.longitude, "acc": $0.horizontalAccuracy] }, loc == nil ? "no_location" : nil) }
        case "gymSearch":
            GymWatcher.shared.search(body["q"] as? String ?? "gym") { replyHandler($0, nil) }
        case "gymWatch":
            guard let lat = body["lat"] as? Double, let lon = body["lon"] as? Double else { replyHandler(nil, "bad_request"); return }
            GymWatcher.shared.watch(name: body["name"] as? String ?? "My gym", lat: lat, lon: lon, radius: body["radius"] as? Double ?? 150) { replyHandler($0, nil) }
        case "gymStop":
            GymWatcher.shared.stop(); replyHandler(true, nil)
        case "gymVisits":
            let w = GymWatcher.shared
            replyHandler(["visits": w.visits, "inside": w.inside, "status": w.statusName, "watching": w.gym != nil], nil)
        case "gymMap":
            GymWatcher.shared.showMap(); replyHandler(true, nil)
        case "listenStop":
            SpeechInput.shared.finish(); replyHandler(true, nil)
        default:
            replyHandler(nil, "bad_request")
        }
    }

    static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
        var top = scene?.windows.first { $0.isKeyWindow }?.rootViewController ?? scene?.windows.first?.rootViewController
        while let next = top?.presentedViewController { top = next }
        return top
    }
}

// MARK: Speech to text
// The page has no microphone of its own inside the app, so the app listens and sends the words
// to window.__speech({type: "partial"|"final"|"state", text, state, reason}). It stops by itself
// after a short pause, or when the page asks.
final class SpeechInput: NSObject {
    static let shared = SpeechInput()
    private let recognizer = SFSpeechRecognizer(locale: Locale.current) ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private weak var web: WKWebView?
    private var lastText = ""
    private var quiet: Timer?
    private var active = false

    func start(web: WKWebView?, done: @escaping (String?) -> Void) {
        self.web = web
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else { DispatchQueue.main.async { done("not_granted") }; return }
            AVAudioApplication.requestRecordPermission { ok in
                DispatchQueue.main.async {
                    guard ok else { done("not_granted"); return }
                    guard let r = self.recognizer, r.isAvailable else { done("unavailable"); return }
                    do { try self.begin(r); done(nil) } catch { self.cleanup(); done("unavailable") }
                }
            }
        }
    }

    private func begin(_ r: SFSpeechRecognizer) throws {
        cleanup()
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement, options: .duckOthers)
        try session.setActive(true, options: .notifyOthersOnDeactivation)
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        req.addsPunctuation = true
        request = req
        let input = engine.inputNode
        input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { buf, _ in req.append(buf) }
        engine.prepare()
        try engine.start()
        active = true; lastText = ""
        emit(["type": "state", "state": "listening"])
        task = r.recognitionTask(with: req) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self else { return }
                if let result {
                    let text = result.bestTranscription.formattedString
                    if result.isFinal {
                        self.emit(["type": "final", "text": text]); self.stopped("stopped"); return
                    }
                    if text != self.lastText { self.lastText = text; self.emit(["type": "partial", "text": text]); self.armQuiet() }
                }
                if error != nil {
                    // Ended without a final result: hand over what was heard so far.
                    if !self.lastText.isEmpty { self.emit(["type": "final", "text": self.lastText]) }
                    self.stopped(self.lastText.isEmpty ? "no_speech" : "stopped")
                }
            }
        }
        armQuiet(first: true)
    }

    // Stop listening after a pause: 2 seconds once words have come, 6 if nothing has been said yet.
    private func armQuiet(first: Bool = false) {
        quiet?.invalidate()
        quiet = Timer.scheduledTimer(withTimeInterval: first ? 6 : 2, repeats: false) { [weak self] _ in self?.finish() }
    }

    func finish() {
        guard active else { return }
        quiet?.invalidate()
        emit(["type": "state", "state": "finishing"])
        engine.stop(); engine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
    }

    private func stopped(_ reason: String) {
        guard active else { return }
        cleanup()
        emit(["type": "state", "state": "idle", "reason": reason])
    }

    private func cleanup() {
        quiet?.invalidate(); quiet = nil
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        task?.cancel(); task = nil; request = nil; active = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func emit(_ payload: [String: Any]) {
        guard let web, let data = try? JSONSerialization.data(withJSONObject: payload), let json = String(data: data, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.__speech && window.__speech(\(json))")
    }
}

// MARK: Streak reminders

enum Reminders {
    // Hours before the clock runs out, and what each reminder says.
    private static let marks: [(hours: Double, text: (Int) -> String)] = [
        (12, { d in "12 hours left on your clock. A gym photo today keeps your \(d) day streak going." }),
        (3, { d in "3 hours left. Snap a gym photo to keep your \(d) day streak." }),
        (1, { d in "1 hour left on your \(d) day streak. Even a short session counts." }),
    ]

    static func schedule(on: Bool, deadline: Date?, days: Int, done: @escaping (Bool) -> Void) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: marks.map { "streak-\(Int($0.hours))" })
        guard on, let deadline, deadline > Date() else { done(true); return }
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            guard granted else { DispatchQueue.main.async { done(false) }; return }
            for m in marks {
                let fire = deadline.addingTimeInterval(-m.hours * 3600)
                let wait = fire.timeIntervalSinceNow
                guard wait > 60 else { continue }
                let content = UNMutableNotificationContent()
                content.title = days > 0 ? "Lock In: \(days) day streak" : "Lock In"
                content.body = m.text(max(days, 1))
                content.sound = .default
                let req = UNNotificationRequest(identifier: "streak-\(Int(m.hours))", content: content,
                                                trigger: UNTimeIntervalNotificationTrigger(timeInterval: wait, repeats: false))
                center.add(req)
            }
            DispatchQueue.main.async { done(true) }
        }
    }
}

// MARK: Apple Maps

struct GymPlace: Identifiable, Hashable {
    let name: String, city: String, lat: Double, lon: Double, count: Int
    var id: String { name }
    var coord: CLLocationCoordinate2D { .init(latitude: lat, longitude: lon) }

    init?(_ d: [String: Any]) {
        guard let name = d["name"] as? String, let lat = d["lat"] as? Double, let lon = d["lon"] as? Double else { return nil }
        self.name = name; self.city = d["city"] as? String ?? ""; self.lat = lat; self.lon = lon; self.count = d["count"] as? Int ?? 0
    }
}

struct GymMapView: View {
    let places: [GymPlace]
    let onClose: () -> Void
    @State private var position: MapCameraPosition
    @State private var selected: String?

    init(places: [GymPlace], focus: GymPlace, onClose: @escaping () -> Void) {
        self.places = places; self.onClose = onClose
        _position = State(initialValue: .region(MKCoordinateRegion(center: focus.coord, latitudinalMeters: 2500, longitudinalMeters: 2500)))
        _selected = State(initialValue: focus.name)
    }

    private var current: GymPlace? { places.first { $0.name == selected } }

    var body: some View {
        NavigationStack {
            Map(position: $position, selection: $selected) {
                ForEach(places) { p in
                    Marker("\(p.name) · \(p.count)", systemImage: "dumbbell.fill", coordinate: p.coord)
                        .tint(Color(red: 1, green: 0.353, blue: 0.122))
                        .tag(p.name)
                }
                UserAnnotation()
            }
            .mapStyle(.standard(pointsOfInterest: .including([.fitnessCenter, .university, .park])))
            .mapControls { MapCompass(); MapScaleView() }
            .safeAreaInset(edge: .bottom) {
                if let p = current {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(p.name).font(.headline)
                            Text("\(p.count) \(p.count == 1 ? "person" : "people") checked in here, last 48 hours").font(.subheadline).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button {
                            let q = p.name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
                            if let url = URL(string: "https://maps.apple.com/?daddr=\(p.lat),\(p.lon)&q=\(q)") { UIApplication.shared.open(url) }
                        } label: {
                            Label("Directions", systemImage: "arrow.triangle.turn.up.right.diamond.fill")
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color(red: 1, green: 0.353, blue: 0.122))
                    }
                    .padding(16)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22))
                    .padding(.horizontal, 12)
                    .padding(.bottom, 8)
                }
            }
            .navigationTitle("Where friends trained")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done", action: onClose) } }
        }
    }
}
