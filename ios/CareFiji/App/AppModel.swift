import Combine
import Foundation
import LocalAuthentication

@MainActor
final class AppModel: ObservableObject {
    @Published var email = ""
    @Published var otp = ""
    @Published private(set) var otpRequested = false
    @Published private(set) var isAuthenticated = false
    @Published private(set) var authError: String?
    @Published var showSplash = true
    let sync: SyncCoordinator
    private let api: APIClient

    init(api: APIClient, persistence: PersistenceController = .shared) {
        self.api = api
        self.sync = SyncCoordinator(persistence: persistence, api: api)
        if let tokens = KeychainStore.load() {
            sync.tokens = tokens
            isAuthenticated = true
        }
    }

    func requestOTP() async {
        authError = nil
        do { try await api.requestOTP(email: email.trimmingCharacters(in: .whitespacesAndNewlines)); otpRequested = true }
        catch { authError = error.localizedDescription }
    }

    func verifyOTP() async {
        authError = nil
        do {
            let tokens = try await api.verifyOTP(email: email.trimmingCharacters(in: .whitespacesAndNewlines), token: otp.trimmingCharacters(in: .whitespacesAndNewlines))
            try KeychainStore.save(tokens)
            sync.tokens = tokens
            isAuthenticated = true
            await sync.sync(reason: "authentication")
        } catch { authError = error.localizedDescription }
    }

    func unlockWithBiometrics() async {
        guard KeychainStore.load() != nil else { return }
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else { return }
        do {
            if try await context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "Open your CareFiji patient information") { isAuthenticated = true }
        } catch { authError = "Biometric verification was not completed." }
    }

    func signOut() {
        KeychainStore.clear()
        sync.tokens = nil
        try? sync.clearLocalData()
        isAuthenticated = false
        otpRequested = false
        otp = ""
    }
}
