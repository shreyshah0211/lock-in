import SwiftUI
import UIKit
import WebKit

// Shows the bundled web app edge to edge. The page handles the notch and the
// home bar itself, so the web view is told not to add its own insets.
struct WebScreen: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true          // the live camera view plays inside the page
        config.mediaTypesRequiringUserActionForPlayback = []
        // Photo recognition, meal estimates and Say it ask Claude through this handler.
        config.userContentController.addScriptMessageHandler(ClaudeBridge(), contentWorld: .page, name: ClaudeBridge.handlerName)
        // Barcode scanning and product lookup for the Food tab.
        config.userContentController.addScriptMessageHandler(FoodScanner(), contentWorld: .page, name: FoodScanner.handlerName)

        let web = WKWebView(frame: .zero, configuration: config)
        web.uiDelegate = context.coordinator
        web.navigationDelegate = context.coordinator
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.bounces = false
        web.allowsLinkPreview = false
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.071, green: 0.086, blue: 0.169, alpha: 1)
        web.scrollView.backgroundColor = web.backgroundColor
        if #available(iOS 16.4, *) {
            web.isInspectable = true                     // lets Safari on the Mac inspect the page while testing
        }

        if let page = Bundle.main.url(forResource: "index", withExtension: "html") {
            web.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
        }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
    }

    final class Coordinator: NSObject, WKUIDelegate, WKNavigationDelegate {
        // iOS has already asked for the camera or the microphone once for the app.
        // This stops the page from asking a second time on every launch.
        func webView(_ webView: WKWebView,
                     requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                     initiatedByFrame frame: WKFrameInfo,
                     type: WKMediaCaptureType,
                     decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(.grant)
        }

        // Links that leave the app (a calendar link, for example) open in Safari.
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if navigationAction.navigationType == .linkActivated,
               let url = navigationAction.request.url,
               url.scheme == "https" || url.scheme == "http" {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        // The same for links that ask for a new window.
        func webView(_ webView: WKWebView,
                     createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url {
                UIApplication.shared.open(url)
            }
            return nil
        }
    }
}
