import Foundation
import MapKit
import SwiftUI
import UIKit
import UserNotifications
import WebKit

// Native pieces the page asks for through the "app" message handler (see src/js/22-native.js):
//   {op: "map", places: [{name, city, lat, lon, count}], focus: "name"} -> shows the gyms in Apple Maps
//   {op: "remind", on: true, deadline: <ms since 1970>, days: 23}   -> schedules streak reminders
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
