import Foundation
import SwiftUI
import UIKit
import Vision
import VisionKit
import WebKit

// Barcode scanning and product lookup for the Food tab.
//
// iPhone web views cannot read barcodes, so the page asks the app through the
// "food" message handler (see src/js/20-barcode.js):
//   {op: "canScan"}            -> true when this iPhone can scan live
//   {op: "scan"}               -> the barcode digits, or rejects "cancelled" / "unsupported"
//   {op: "product", code: "…"} -> the product as JSON text, or rejects "not_found" / "offline"
//   {op: "detect", image: "<base64 JPEG>"} -> what a barcode or QR code in the image says, or null
// Products come from Open Food Facts (world.openfoodfacts.org), a free, open database.
final class FoodScanner: NSObject, WKScriptMessageHandlerWithReply {
    static let handlerName = "food"

    private var pending: ((Any?, String?) -> Void)?
    private weak var scanner: DataScannerViewController?

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let op = body["op"] as? String else {
            replyHandler(nil, "bad_request"); return
        }
        switch op {
        case "canScan":
            replyHandler(Self.canScan, nil)
        case "scan":
            startScan(replyHandler)
        case "product":
            let code = (body["code"] as? String ?? "").filter(\.isNumber)
            guard (6...14).contains(code.count) else { replyHandler(nil, "not_found"); return }
            Task {
                do {
                    let json = try await Self.lookup(code)
                    await MainActor.run { replyHandler(json, nil) }
                } catch let e as LookupError {
                    await MainActor.run { replyHandler(nil, e.code) }
                } catch {
                    await MainActor.run { replyHandler(nil, "offline") }
                }
            }
        case "detect":
            guard let b64 = body["image"] as? String, let data = Data(base64Encoded: b64), let img = UIImage(data: data)?.cgImage else { replyHandler(nil, nil); return }
            DispatchQueue.global(qos: .userInitiated).async {
                let code = Self.barcode(in: img)
                DispatchQueue.main.async { replyHandler(code, nil) }
            }
        default:
            replyHandler(nil, "bad_request")
        }
    }

    // MARK: A barcode in a photo taken with the app's one camera

    static func barcode(in img: CGImage) -> String? {
        let req = VNDetectBarcodesRequest()
        req.symbologies = [.ean13, .ean8, .upce, .code128, .itf14, .qr]
        try? VNImageRequestHandler(cgImage: img, options: [:]).perform([req])
        // The page decides what counts: product numbers, and QR codes that carry one.
        return (req.results ?? []).filter { $0.confidence > 0.5 }.compactMap { $0.payloadStringValue }.first { !$0.isEmpty }
    }

    // MARK: Scanning

    static var canScan: Bool { DataScannerViewController.isSupported && DataScannerViewController.isAvailable }

    private func startScan(_ reply: @escaping (Any?, String?) -> Void) {
        guard Self.canScan, let host = Self.topViewController() else { reply(nil, "unsupported"); return }
        finish(nil, "cancelled")                       // a scan already open is replaced
        let vc = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.ean13, .ean8, .upce, .code128, .itf14])],
            qualityLevel: .balanced,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false,
            isPinchToZoomEnabled: true,
            isGuidanceEnabled: true,
            isHighlightingEnabled: true)
        vc.delegate = self
        pending = reply
        scanner = vc

        let wrap = UINavigationController(rootViewController: vc)
        vc.navigationItem.title = "Scan a barcode"
        vc.navigationItem.leftBarButtonItem = UIBarButtonItem(systemItem: .cancel, primaryAction: UIAction { [weak self] _ in
            self?.finish(nil, "cancelled")
        })
        vc.navigationItem.rightBarButtonItem = UIBarButtonItem(title: "Type it", primaryAction: UIAction { [weak self] _ in
            self?.finish(nil, "type")
        })
        wrap.modalPresentationStyle = .fullScreen
        host.present(wrap, animated: true) {
            do { try vc.startScanning() } catch { self.finish(nil, "unsupported") }
        }
    }

    fileprivate func finish(_ code: String?, _ error: String?) {
        guard let reply = pending else { return }
        pending = nil
        let vc = scanner
        vc?.stopScanning()
        let done = { reply(code, error) }
        if let nav = vc?.navigationController, nav.presentingViewController != nil {
            nav.dismiss(animated: true, completion: done)
        } else { done() }
    }

    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive }
            ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        var top = scene?.windows.first { $0.isKeyWindow }?.rootViewController ?? scene?.windows.first?.rootViewController
        while let next = top?.presentedViewController { top = next }
        return top
    }

    // MARK: Product lookup

    private struct LookupError: Error { let code: String }

    private static let fields = "code,product_name,brands,quantity,serving_size,serving_quantity,nutrition_data_per,nutriments,nutriscore_grade,nova_group,additives_tags,allergens_tags,ingredients_text,image_front_small_url"

    static func lookup(_ code: String) async throws -> String {
        var url = URLComponents(string: "https://world.openfoodfacts.org/api/v2/product/\(code).json")!
        url.queryItems = [URLQueryItem(name: "fields", value: fields)]
        var req = URLRequest(url: url.url!, timeoutInterval: 20)
        req.setValue("LockIn/1.0 (personal iOS app)", forHTTPHeaderField: "User-Agent")
        let (data, resp) = try await URLSession.shared.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
            throw LookupError(code: status == 404 ? "not_found" : "offline")
        }
        guard (json["status"] as? Int) == 1, let product = json["product"] as? [String: Any] else {
            throw LookupError(code: "not_found")
        }
        let out = try JSONSerialization.data(withJSONObject: product)
        return String(decoding: out, as: UTF8.self)
    }
}

extension FoodScanner: DataScannerViewControllerDelegate {
    func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
        for item in addedItems {
            if case .barcode(let b) = item, let value = b.payloadStringValue, !value.isEmpty {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                finish(value, nil)
                return
            }
        }
    }

    func dataScanner(_ dataScanner: DataScannerViewController, becameUnavailableWithError error: DataScannerViewController.ScanningUnavailable) {
        finish(nil, "unsupported")
    }
}
