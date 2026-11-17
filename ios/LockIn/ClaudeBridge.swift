import Foundation
import WebKit

// Lets the page ask Claude when it runs inside the iPhone app.
//
// On claude.ai the page asks Claude through window.claude. Inside this app there is
// no such thing, so the page posts to the "claude" message handler instead
// (see src/js/09-ai.js) and this class makes the Claude API call. The API key stays
// on the native side: it is read from Info.plist (filled from ios/Config/Secrets.xcconfig)
// and is never handed to the page.
//
// Messages from the page:
//   {op: "status"}                                   -> {"ready": true|false}
//   {op: "json", prompt: "...", images: [{type, data}]} -> the model's reply text (a JSON object)
// Failures reject with one short code the page already understands:
//   not_granted (no key), rate_limited, refused, upstream_error.
final class ClaudeBridge: NSObject, WKScriptMessageHandlerWithReply {
    static let handlerName = "claude"

    private let model = "claude-opus-5-5"
    private let endpoint = URL(string: "https://api.anthropic.com/v1/messages")!

    private lazy var apiKey: String? = {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "ClaudeAPIKey") as? String ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        // An unset build setting leaves the literal "$(CLAUDE_API_KEY)" or nothing at all.
        return raw.isEmpty || raw.hasPrefix("$(") ? nil : raw
    }()

    private lazy var session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 90
        return URLSession(configuration: cfg)
    }()

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let op = body["op"] as? String else {
            replyHandler(nil, "upstream_error"); return
        }
        switch op {
        case "status":
            replyHandler(["ready": apiKey != nil], nil)
        case "json":
            guard let key = apiKey else { replyHandler(nil, "not_granted"); return }
            let prompt = body["prompt"] as? String ?? ""
            let images = body["images"] as? [[String: Any]] ?? []
            Task {
                do {
                    let text = try await self.ask(key: key, prompt: prompt, images: images)
                    await MainActor.run { replyHandler(text, nil) }
                } catch let e as BridgeError {
                    await MainActor.run { replyHandler(nil, e.code) }
                } catch {
                    await MainActor.run { replyHandler(nil, "upstream_error") }
                }
            }
        default:
            replyHandler(nil, "upstream_error")
        }
    }

    private struct BridgeError: Error { let code: String }

    private func ask(key: String, prompt: String, images: [[String: Any]]) async throws -> String {
        var content: [[String: Any]] = []
        for img in images {
            guard let data = img["data"] as? String, !data.isEmpty else { continue }
            let type = (img["type"] as? String).flatMap { ["image/jpeg", "image/png", "image/gif", "image/webp"].contains($0) ? $0 : nil } ?? "image/jpeg"
            content.append(["type": "image", "source": ["type": "base64", "media_type": type, "data": data]])
        }
        content.append(["type": "text", "text": prompt])

        let payload: [String: Any] = [
            "model": model,
            "max_tokens": 16000,
            // Quick, single-shot jobs (file a photo, estimate a meal): keep thinking short.
            "output_config": ["effort": "low"],
            // If a safety classifier declines, let the API retry on a suitable model.
            "fallbacks": "default",
            "messages": [["role": "user", "content": content]],
        ]

        var req = URLRequest(url: endpoint)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.setValue(key, forHTTPHeaderField: "x-api-key")
        req.setValue("2026-10-21", forHTTPHeaderField: "anthropic-version")
        req.setValue("server-side-fallback-2026-07-01", forHTTPHeaderField: "anthropic-beta")
        req.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, resp) = try await session.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]

        guard status == 200, let json else {
            let detail = ((json?["error"] as? [String: Any])?["message"] as? String) ?? String(data: data, encoding: .utf8) ?? ""
            NSLog("[LockIn] Claude API %d: %@", status, detail)
            switch status {
            case 401, 403: throw BridgeError(code: "not_granted")
            case 429, 529: throw BridgeError(code: "rate_limited")
            default: throw BridgeError(code: "upstream_error")
            }
        }
        if (json["stop_reason"] as? String) == "refusal" { throw BridgeError(code: "refused") }

        let text = (json["content"] as? [[String: Any]] ?? [])
            .filter { ($0["type"] as? String) == "text" }
            .compactMap { $0["text"] as? String }
            .joined()
        guard let obj = Self.firstJSONObject(in: text) else {
            NSLog("[LockIn] Claude reply had no JSON object: %@", text)
            throw BridgeError(code: "upstream_error")
        }
        return obj
    }

    // The prompts ask for only a JSON object, but tolerate a code fence or a stray sentence around it.
    static func firstJSONObject(in text: String) -> String? {
        guard let start = text.firstIndex(of: "{"), let end = text.lastIndex(of: "}"), start < end else { return nil }
        let candidate = String(text[start...end])
        guard let d = candidate.data(using: .utf8), (try? JSONSerialization.jsonObject(with: d)) is [String: Any] else { return nil }
        return candidate
    }
}
