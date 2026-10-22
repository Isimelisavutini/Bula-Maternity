import Foundation

enum APIError: LocalizedError {
    case invalidConfiguration, invalidResponse, unauthorized, server(String, Bool), secureStorage

    var errorDescription: String? {
        switch self {
        case .invalidConfiguration: return "CareFiji is not configured for this environment."
        case .invalidResponse: return "The service returned an invalid response."
        case .unauthorized: return "Your session expired. Please sign in again."
        case let .server(message, _): return message
        case .secureStorage: return "The secure session could not be stored."
        }
    }

    var retryable: Bool { if case let .server(_, retryable) = self { return retryable }; return false }
}

struct APIErrorEnvelope: Codable { let error: APIErrorBody }
struct APIErrorBody: Codable { let code: String; let message: String; let retryable: Bool }
struct CommandResponse: Codable { let serverTime: Date }
struct OTPRequest: Codable {
    let email: String
    let createUser: Bool
    enum CodingKeys: String, CodingKey { case email; case createUser = "create_user" }
}
struct VerifyRequest: Codable { let email: String; let token: String; let type: String }
struct RefreshRequest: Codable {
    let refreshToken: String
    enum CodingKeys: String, CodingKey { case refreshToken = "refresh_token" }
}
struct VerifyResponse: Codable { let accessToken: String; let refreshToken: String; let expiresIn: Double }
struct RefreshResponse: Codable { let accessToken: String; let refreshToken: String; let expiresIn: Double }

final class APIClient {
    static let encoder: JSONEncoder = { let value = JSONEncoder(); value.dateEncodingStrategy = .iso8601; return value }()
    static let decoder: JSONDecoder = { let value = JSONDecoder(); value.keyDecodingStrategy = .convertFromSnakeCase; value.dateDecodingStrategy = .iso8601; return value }()

    private let session: URLSession
    private let apiBaseURL: URL
    private let supabaseURL: URL
    private let anonKey: String

    init(session: URLSession = .shared, bundle: Bundle = .main) throws {
        guard let api = bundle.object(forInfoDictionaryKey: "CareFijiAPIBaseURL") as? String,
              let apiURL = URL(string: api),
              let supabase = bundle.object(forInfoDictionaryKey: "SupabaseURL") as? String,
              let supabaseURL = URL(string: supabase),
              let anon = bundle.object(forInfoDictionaryKey: "SupabaseAnonKey") as? String,
              !anon.isEmpty else { throw APIError.invalidConfiguration }
        self.session = session
        self.apiBaseURL = apiURL
        self.supabaseURL = supabaseURL
        self.anonKey = anon
    }

    func requestOTP(email: String) async throws {
        var request = URLRequest(url: supabaseURL.appendingPathComponent("auth/v1/otp"))
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try Self.encoder.encode(OTPRequest(email: email, createUser: false))
        let (_, response) = try await session.data(for: request)
        try Self.validate(response)
    }

    func verifyOTP(email: String, token: String) async throws -> SessionTokens {
        var request = URLRequest(url: supabaseURL.appendingPathComponent("auth/v1/verify"))
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try Self.encoder.encode(VerifyRequest(email: email, token: token, type: "email"))
        let (data, response) = try await session.data(for: request)
        try Self.validate(response)
        let value = try Self.decoder.decode(VerifyResponse.self, from: data)
        return SessionTokens(accessToken: value.accessToken, refreshToken: value.refreshToken, expiresAt: Date().addingTimeInterval(value.expiresIn))
    }

    func refresh(_ tokens: SessionTokens) async throws -> SessionTokens {
        var components = URLComponents(url: supabaseURL.appendingPathComponent("auth/v1/token"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try Self.encoder.encode(RefreshRequest(refreshToken: tokens.refreshToken))
        let (data, response) = try await session.data(for: request)
        try Self.validate(response)
        let value = try Self.decoder.decode(RefreshResponse.self, from: data)
        return SessionTokens(accessToken: value.accessToken, refreshToken: value.refreshToken, expiresAt: Date().addingTimeInterval(value.expiresIn))
    }

    func bootstrap(token: String) async throws -> BootstrapResponse {
        try await send(path: "api/mobile/v1/bootstrap", token: token)
    }

    func sync(cursor: String, token: String) async throws -> SyncResponse {
        try await send(path: "api/mobile/v1/sync?cursor=\(cursor)", token: token)
    }

    func send(command: MobileCommand, token: String) async throws {
        let _: CommandResponse = try await send(path: "api/mobile/v1/commands", token: token, method: "POST", body: Self.encoder.encode(command))
    }

    private func send<T: Decodable>(path: String, token: String, method: String = "GET", body: Data? = nil) async throws -> T {
        guard let url = URL(string: path, relativeTo: apiBaseURL) else { throw APIError.invalidConfiguration }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if http.statusCode == 401 { throw APIError.unauthorized }
        guard (200..<300).contains(http.statusCode) else {
            if let envelope = try? Self.decoder.decode(APIErrorEnvelope.self, from: data) { throw APIError.server(envelope.error.message, envelope.error.retryable) }
            throw APIError.invalidResponse
        }
        return try Self.decoder.decode(T.self, from: data)
    }

    private static func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw APIError.invalidResponse }
    }
}
