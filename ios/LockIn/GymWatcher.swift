import CoreLocation
import Foundation
import MapKit
import SwiftUI
import UIKit
import UserNotifications

// Knows when you are at your gym. You set the gym once (where you are now, or a search);
// iOS then wakes the app when you arrive and leave, even when it is closed, and each
// visit is kept on the phone. The page reads the visits to show how long you trained.
// Nothing about where you are is sent anywhere.
final class GymWatcher: NSObject, CLLocationManagerDelegate {
    static let shared = GymWatcher()
    private let manager = CLLocationManager()
    private let regionID = "lockin-gym"
    private var oneShot: [(CLLocation?) -> Void] = []

    private let defaults = UserDefaults.standard
    private let visitsKey = "gymVisits", gymKey = "gymPlace"

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
    }

    // MARK: The gym

    var gym: [String: Any]? { defaults.dictionary(forKey: gymKey) }

    func watch(name: String, lat: Double, lon: Double, radius: Double, done: @escaping (String) -> Void) {
        defaults.set(["name": name, "lat": lat, "lon": lon, "radius": radius], forKey: gymKey)
        for r in manager.monitoredRegions where r.identifier == regionID { manager.stopMonitoring(for: r) }
        let region = CLCircularRegion(center: .init(latitude: lat, longitude: lon), radius: min(max(radius, 100), 400), identifier: regionID)
        region.notifyOnEntry = true; region.notifyOnExit = true
        authorizeAlways { status in
            self.manager.startMonitoring(for: region)
            self.manager.requestState(for: region)
            done(status)
        }
    }

    func stop() {
        for r in manager.monitoredRegions where r.identifier == regionID { manager.stopMonitoring(for: r) }
        defaults.removeObject(forKey: gymKey)
    }

    // "always" lets iOS tell the app about arrivals while it is closed; "when_in_use" only while it is open.
    private var authWait: ((String) -> Void)?
    private func authorizeAlways(_ done: @escaping (String) -> Void) {
        switch manager.authorizationStatus {
        case .notDetermined: authWait = done; manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse: authWait = done; manager.requestAlwaysAuthorization()
            // iOS may not show the second prompt at all; answer anyway after a moment
            DispatchQueue.main.asyncAfter(deadline: .now() + 4) { if let w = self.authWait { self.authWait = nil; w(self.statusName) } }
        default: done(statusName)
        }
    }
    var statusName: String {
        switch manager.authorizationStatus {
        case .authorizedAlways: return "always"
        case .authorizedWhenInUse: return "when_in_use"
        case .denied, .restricted: return "denied"
        default: return "unknown"
        }
    }
    func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        if m.authorizationStatus == .authorizedWhenInUse, authWait != nil { m.requestAlwaysAuthorization(); return }
        if let w = authWait, m.authorizationStatus != .notDetermined { authWait = nil; w(statusName) }
    }

    // MARK: Where you are now

    func here(_ done: @escaping (CLLocation?) -> Void) {
        oneShot.append(done)
        switch manager.authorizationStatus {
        case .notDetermined: authWait = { _ in self.manager.requestLocation() }; manager.requestWhenInUseAuthorization()
        case .denied, .restricted: flush(nil)
        default: manager.requestLocation()
        }
    }
    func locationManager(_ m: CLLocationManager, didUpdateLocations locations: [CLLocation]) { flush(locations.last) }
    func locationManager(_ m: CLLocationManager, didFailWithError error: Error) { flush(nil) }
    private func flush(_ loc: CLLocation?) { let w = oneShot; oneShot = []; w.forEach { $0(loc) } }

    func search(_ q: String, done: @escaping ([[String: Any]]) -> Void) {
        here { loc in
            let req = MKLocalSearch.Request()
            req.naturalLanguageQuery = q
            if let loc { req.region = MKCoordinateRegion(center: loc.coordinate, latitudinalMeters: 30000, longitudinalMeters: 30000) }
            MKLocalSearch(request: req).start { res, _ in
                let items = (res?.mapItems ?? []).prefix(8).map { it -> [String: Any] in
                    let c = it.placemark.coordinate
                    var d: [String: Any] = ["name": it.name ?? q, "lat": c.latitude, "lon": c.longitude, "address": it.placemark.title ?? ""]
                    if let loc { d["km"] = loc.distance(from: CLLocation(latitude: c.latitude, longitude: c.longitude)) / 1000 }
                    return d
                }
                DispatchQueue.main.async { done(Array(items)) }
            }
        }
    }

    // MARK: Visits

    // [{in: ms, out: ms or missing}], newest last
    var visits: [[String: Double]] { (defaults.array(forKey: visitsKey) as? [[String: Double]]) ?? [] }
    private func save(_ v: [[String: Double]]) { defaults.set(Array(v.suffix(120)), forKey: visitsKey) }
    var inside: Bool { visits.last.map { $0["out"] == nil } ?? false }

    private func arrived() {
        var v = visits; let t = Date().timeIntervalSince1970 * 1000
        if let last = v.last, last["out"] == nil {
            if t - last["in"]! < 6 * 3600_000 { return }          // already inside
            v[v.count - 1]["out"] = last["in"]! + 2 * 3600_000     // a visit left open too long: close it at 2 hours
        }
        // back within 10 minutes of leaving: the same visit (a trip to the car)
        if let last = v.last, let out = last["out"], t - out < 10 * 60_000 { v[v.count - 1].removeValue(forKey: "out"); save(v); return }
        v.append(["in": t]); save(v)
        notify(id: "gym-in", title: "At \(gymName)", body: "Snap your gym photo when you are ready to check in.")
    }
    private func left() {
        var v = visits; guard let last = v.last, last["out"] == nil else { return }
        let t = Date().timeIntervalSince1970 * 1000
        v[v.count - 1]["out"] = t; save(v)
        let mins = Int((t - last["in"]!) / 60_000)
        if mins >= 10 { notify(id: "gym-out", title: "Left \(gymName)", body: "You were there \(mins / 60 > 0 ? "\(mins / 60) h \(mins % 60) min" : "\(mins) min"). It is on today's workout.") }
    }
    private var gymName: String { gym?["name"] as? String ?? "the gym" }

    func locationManager(_ m: CLLocationManager, didEnterRegion region: CLRegion) { if region.identifier == regionID { arrived() } }
    func locationManager(_ m: CLLocationManager, didExitRegion region: CLRegion) { if region.identifier == regionID { left() } }
    func locationManager(_ m: CLLocationManager, didDetermineState state: CLRegionState, for region: CLRegion) {
        guard region.identifier == regionID else { return }
        if state == .inside && !inside { arrived() } else if state == .outside && inside { left() }
    }

    private func notify(id: String, title: String, body: String) {
        let c = UNMutableNotificationContent(); c.title = title; c.body = body; c.sound = .default
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: c, trigger: nil))
    }

    // MARK: Map: your gym, its circle, and you

    func showMap() {
        guard let g = gym, let lat = g["lat"] as? Double, let lon = g["lon"] as? Double, let host = AppBridge.topViewController() else { return }
        if manager.authorizationStatus == .notDetermined { manager.requestWhenInUseAuthorization() }
        let view = MyGymMap(name: g["name"] as? String ?? "My gym", center: .init(latitude: lat, longitude: lon), radius: g["radius"] as? Double ?? 150, inside: inside) {
            host.presentedViewController?.dismiss(animated: true)
        }
        let vc = UIHostingController(rootView: view)
        if let sheet = vc.sheetPresentationController { sheet.detents = [.large()]; sheet.prefersGrabberVisible = true }
        host.present(vc, animated: true)
    }
}

struct MyGymMap: View {
    let name: String, center: CLLocationCoordinate2D, radius: Double, inside: Bool
    let onClose: () -> Void
    @State private var position: MapCameraPosition = .userLocation(fallback: .automatic)

    var body: some View {
        NavigationStack {
            Map(position: $position) {
                MapCircle(center: center, radius: radius).foregroundStyle(Color(red: 1, green: 0.353, blue: 0.122).opacity(0.18))
                    .stroke(Color(red: 1, green: 0.353, blue: 0.122), lineWidth: 2)
                Marker(name, systemImage: "dumbbell.fill", coordinate: center).tint(Color(red: 1, green: 0.353, blue: 0.122))
                UserAnnotation()
            }
            .mapControls { MapUserLocationButton(); MapCompass(); MapScaleView() }
            .onAppear { position = .region(MKCoordinateRegion(center: center, latitudinalMeters: max(radius * 8, 1200), longitudinalMeters: max(radius * 8, 1200))) }
            .safeAreaInset(edge: .bottom) {
                HStack(spacing: 10) {
                    Image(systemName: inside ? "checkmark.circle.fill" : "location.circle").font(.title2)
                        .foregroundStyle(inside ? .green : .secondary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(inside ? "You are at \(name)" : "You are away from \(name)").font(.headline)
                        Text("The orange circle is your gym. Lock In notes when you go in and when you leave.").font(.footnote).foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                }
                .padding(16).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22)).padding(.horizontal, 12).padding(.bottom, 8)
            }
            .navigationTitle("My gym").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done", action: onClose) } }
        }
    }
}
