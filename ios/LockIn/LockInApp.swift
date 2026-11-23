import SwiftUI

// Lock In as an iPhone app. The whole app is the web build in dist/index.html,
// shown full screen. This file starts it; WebScreen.swift hosts the page.
// Whether the screen under the status bar is dark right now. The page says so (see chromeSync in 08-home.js).
final class Chrome: ObservableObject {
    static let shared = Chrome()
    @Published var light = true
}

@main
struct LockInApp: App {
    @StateObject private var chrome = Chrome.shared
    // Created at launch, so iOS can hand it gym arrivals and departures even when the app was closed.
    init() { _ = GymWatcher.shared }

    var body: some Scene {
        WindowGroup {
            WebScreen()
                .ignoresSafeArea()
                .preferredColorScheme(chrome.light ? .dark : .light)
        }
    }
}
