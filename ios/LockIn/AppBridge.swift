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
//   {op: "page", url: "https://..."}                              -> the text of a product page, for locked rewards
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
            let mine = (body["mine"] as? [String: Any]).flatMap(GymPlace.init)
            guard !places.isEmpty || mine != nil, let host = Self.topViewController() else { replyHandler(false, nil); return }
            let focus = body["focus"] as? String
            let view = GymMapView(places: places, mine: mine, focus: focus) {
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
        case "chrome":
            // Light clock and battery over dark screens, dark over light ones.
            Chrome.shared.light = body["light"] as? Bool ?? false
            replyHandler(true, nil)
        case "notes":
            // Reward reminders: the page says what to send and when; anything it sent before is replaced.
            Reminders.notes(body["items"] as? [[String: Any]] ?? []) { replyHandler($0, nil) }
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
        case "page":
            // The text of a store's product page, so a pasted link can show its photo, name and price.
            // https only, no cookies, nothing about you is sent.
            guard let s = body["url"] as? String, let url = URL(string: s), url.scheme == "https" else { replyHandler(nil, "bad_request"); return }
            var req = URLRequest(url: url, timeoutInterval: 12)
            req.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", forHTTPHeaderField: "User-Agent")
            req.setValue("text/html,application/json;q=0.9,*/*;q=0.5", forHTTPHeaderField: "Accept")
            URLSession(configuration: .ephemeral).dataTask(with: req) { data, resp, _ in
                let ok = (resp as? HTTPURLResponse).map { (200..<300).contains($0.statusCode) } ?? false
                let text = ok ? String(decoding: (data ?? Data()).prefix(1_500_000), as: UTF8.self) : ""
                DispatchQueue.main.async { replyHandler(["text": text], nil) }
            }.resume()
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

    // [{id, at: <ms since 1970>, title, body}], at most 8. Used for locked rewards.
    static func notes(_ items: [[String: Any]], done: @escaping (Bool) -> Void) {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { reqs in
            center.removePendingNotificationRequests(withIdentifiers: reqs.map(\.identifier).filter { $0.hasPrefix("rw-") })
            guard !items.isEmpty else { DispatchQueue.main.async { done(true) }; return }
            center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
                guard granted else { DispatchQueue.main.async { done(false) }; return }
                for it in items.prefix(8) {
                    guard let id = it["id"] as? String, let at = it["at"] as? Double, let text = it["body"] as? String else { continue }
                    let wait = at / 1000 - Date().timeIntervalSince1970
                    guard wait > 60 else { continue }
                    let content = UNMutableNotificationContent()
                    content.title = it["title"] as? String ?? "Lock In"
                    content.body = text
                    content.sound = .default
                    center.add(UNNotificationRequest(identifier: "rw-" + id, content: content,
                                                     trigger: UNTimeIntervalNotificationTrigger(timeInterval: wait, repeats: false)))
                }
                DispatchQueue.main.async { done(true) }
            }
        }
    }
}

// MARK: Apple Maps

struct GymPlace: Identifiable, Hashable {
    let name: String, city: String, lat: Double, lon: Double, count: Int, people: [String], radius: Double
    var id: String { name }
    var coord: CLLocationCoordinate2D { .init(latitude: lat, longitude: lon) }

    init?(_ d: [String: Any]) {
        guard let name = d["name"] as? String, let lat = d["lat"] as? Double, let lon = d["lon"] as? Double else { return nil }
        self.name = name; self.city = d["city"] as? String ?? ""; self.lat = lat; self.lon = lon
        self.people = d["people"] as? [String] ?? []; self.count = d["count"] as? Int ?? people.count
        self.radius = d["radius"] as? Double ?? 150
    }

    var who: String {
        let n = people.filter { $0 != "You" }, me = people.contains("You")
        let names = n.count <= 2 ? n.joined(separator: " and ") : "\(n[0]), \(n[1]) and \(n.count - 2) more"
        if names.isEmpty { return me ? "You trained here" : "Nobody in the last 48 hours" }
        return (me ? "You, " : "") + names
    }
}

// The real Apple map, so zooming in shows streets, buildings and places. Friends' gyms are
// orange pins with how many trained there; your own gym has its circle. Tap a pin or a chip
// at the bottom to fly to it and get directions.
struct GymMapView: View {
    let places: [GymPlace]
    let mine: GymPlace?
    let onClose: () -> Void
    @State private var position: MapCameraPosition
    @State private var selected: String?
    private let orange = Color(red: 1, green: 0.353, blue: 0.122)

    init(places: [GymPlace], mine: GymPlace?, focus: String?, onClose: @escaping () -> Void) {
        self.places = places; self.mine = mine; self.onClose = onClose
        let all = places + (mine.map { [$0] } ?? [])
        if let f = all.first(where: { $0.name == focus }) {
            _position = State(initialValue: .region(MKCoordinateRegion(center: f.coord, latitudinalMeters: 1500, longitudinalMeters: 1500)))
            _selected = State(initialValue: f.name)
        } else {
            _position = State(initialValue: .rect(Self.fit(all)))
            _selected = State(initialValue: nil)
        }
    }

    static func fit(_ ps: [GymPlace]) -> MKMapRect {
        var r = MKMapRect.null
        for p in ps { let pt = MKMapPoint(p.coord); r = r.union(MKMapRect(x: pt.x, y: pt.y, width: 0, height: 0)) }
        let pad = max(r.width, r.height, 4000) * 0.35
        return r.insetBy(dx: -pad, dy: -pad)
    }

    private var all: [GymPlace] { places + (mine.flatMap { m in places.contains { $0.name == m.name } ? nil : m }.map { [$0] } ?? []) }
    private var current: GymPlace? { all.first { $0.name == selected } }

    private func fly(_ p: GymPlace) {
        selected = p.name
        withAnimation(.easeInOut(duration: 0.6)) { position = .region(MKCoordinateRegion(center: p.coord, latitudinalMeters: 1200, longitudinalMeters: 1200)) }
    }

    var body: some View {
        NavigationStack {
            Map(position: $position, selection: $selected) {
                if let m = mine {
                    MapCircle(center: m.coord, radius: m.radius).foregroundStyle(orange.opacity(0.15)).stroke(orange, lineWidth: 2)
                }
                ForEach(all) { p in
                    Marker(p.count > 0 ? "\(p.name) · \(p.count)" : p.name, systemImage: p.name == mine?.name ? "star.fill" : "dumbbell.fill", coordinate: p.coord)
                        .tint(orange)
                        .tag(p.name)
                }
                UserAnnotation()
            }
            .mapStyle(.standard(elevation: .realistic, pointsOfInterest: .all))
            .mapControls { MapUserLocationButton(); MapCompass(); MapPitchToggle(); MapScaleView() }
            .onChange(of: selected) { _, n in if let p = all.first(where: { $0.name == n }) { fly(p) } }
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 10) {
                    if let p = current {
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(p.name).font(.headline).lineLimit(1)
                                Text(p.who).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                            }
                            Spacer(minLength: 8)
                            Button {
                                let q = p.name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
                                if let url = URL(string: "https://maps.apple.com/?daddr=\(p.lat),\(p.lon)&q=\(q)") { UIApplication.shared.open(url) }
                            } label: { Label("Go", systemImage: "arrow.triangle.turn.up.right.diamond.fill") }
                            .buttonStyle(.borderedProminent).tint(orange)
                        }
                        .padding(16)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22))
                        .padding(.horizontal, 12)
                    }
                    if all.count > 1 {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(all) { p in
                                    Button { fly(p) } label: {
                                        Text(p.count > 0 ? "\(p.name) · \(p.count)" : p.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                                            .padding(.horizontal, 14).padding(.vertical, 9)
                                            .background(p.name == selected ? AnyShapeStyle(orange) : AnyShapeStyle(.regularMaterial), in: Capsule())
                                            .foregroundStyle(p.name == selected ? .white : .primary)
                                    }
                                }
                            }
                            .padding(.horizontal, 12)
                        }
                    }
                }
                .padding(.bottom, 8)
            }
            .navigationTitle("Where friends trained")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { selected = nil; withAnimation { position = .rect(Self.fit(all)) } } label: { Image(systemName: "map") }.accessibilityLabel("Show all gyms")
                }
                ToolbarItem(placement: .confirmationAction) { Button("Done", action: onClose) }
            }
        }
    }
}
