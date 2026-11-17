import SwiftUI

// Lock In as an iPhone app. The whole app is the web build in dist/index.html,
// shown full screen. This file starts it; WebScreen.swift hosts the page.
@main
struct LockInApp: App {
    var body: some Scene {
        WindowGroup {
            WebScreen()
                .ignoresSafeArea()
        }
    }
}
