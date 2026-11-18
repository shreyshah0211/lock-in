import SwiftUI

// Lock In as an iPhone app. The whole app is the web build in dist/index.html,
// shown full screen. This file starts it; WebScreen.swift hosts the page.
@main
struct LockInApp: App {
    // Created at launch, so iOS can hand it gym arrivals and departures even when the app was closed.
    init() { _ = GymWatcher.shared }

    var body: some Scene {
        WindowGroup {
            WebScreen()
                .ignoresSafeArea()
        }
    }
}
