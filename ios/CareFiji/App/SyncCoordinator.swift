import BackgroundTasks
import Combine
import Foundation
import Network

@MainActor
final class SyncCoordinator: ObservableObject {
    @Published private(set) var state: SyncState = .idle
    @Published private(set) var snapshot: BootstrapData?
    @Published private(set) var lastUpdated: Date?
    @Published private(set) var pendingCount = 0
    @Published private(set) var isOnline = true
    @Published private(set) var clockWarning = false

    private let persistence: PersistenceController
    private let api: APIClient
    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "fj.gov.health.carefiji.network")
    private var cursor = "0"
    private var timer: Timer?
    private var syncTask: Task<Void, Never>?
    var tokens: SessionTokens?

    init(persistence: PersistenceController = .shared, api: APIClient) {
        self.persistence = persistence
        self.api = api
        if let cache = persistence.loadCache() {
            snapshot = cache.0
            cursor = cache.1
            lastUpdated = cache.2
        }
        pendingCount = persistence.pendingCount()
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                let becameOnline = self?.isOnline == false && path.status == .satisfied
                self?.isOnline = path.status == .satisfied
                if becameOnline { await self?.sync(reason: "network-recovery") }
                if path.status != .satisfied { self?.state = .offline }
            }
        }
        monitor.start(queue: monitorQueue)
    }

    deinit { monitor.cancel(); timer?.invalidate(); syncTask?.cancel() }

    func startForegroundPolling() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 180, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.sync(reason: "foreground-timer") }
        }
        Task { await sync(reason: "foreground-resume") }
    }

    func stopForegroundPolling() {
        timer?.invalidate()
        timer = nil
        scheduleBackgroundRefresh()
    }

    func sync(reason: String) async {
        guard isOnline, state != .syncing, tokens != nil else { if !isOnline { state = .offline }; return }
        state = .syncing
        do {
            let token = try await validAccessToken()
            try await flushOutbox(token: token)
            if snapshot == nil {
                try await loadBootstrap(token: token)
            } else {
                var response = try await api.sync(cursor: cursor, token: token)
                if !response.changes.isEmpty { try await loadBootstrap(token: token) }
                while response.hasMore {
                    response = try await api.sync(cursor: response.cursor, token: token)
                    if !response.changes.isEmpty { try await loadBootstrap(token: token) }
                }
                cursor = response.cursor
                lastUpdated = response.serverTime
                clockWarning = !PregnancyCalculator.clockSkewIsReasonable(device: Date(), server: response.serverTime)
                if let snapshot { try persistence.saveCache(snapshot, cursor: cursor, at: response.serverTime) }
            }
            state = .idle
        } catch APIError.unauthorized {
            state = .failed("Your session expired. Please sign in again.")
        } catch {
            state = isOnline ? .failed(error.localizedDescription) : .offline
        }
        pendingCount = persistence.pendingCount()
        _ = reason
    }

    func queueKick() async throws {
        let now = Date()
        let command = MobileCommand(id: UUID(), type: "log_kick", deviceTimestamp: now, timezone: TimeZone.current.identifier, baseRevision: nil, payload: [:])
        try persistence.enqueue(command)
        if var value = snapshot {
            value = BootstrapData(profiles: value.profiles, pregnancies: value.pregnancies, appointments: value.appointments, kickEvents: value.kickEvents + [KickEvent(id: command.id, occurredAt: now, revision: 0)], wardAllocations: value.wardAllocations)
            snapshot = value
        }
        pendingCount = persistence.pendingCount()
        await sync(reason: "kick")
    }

    func queueAppointment(service: String, date: Date) async throws {
        let id = UUID()
        let payload = ["service": service, "scheduledAt": ISO8601DateFormatter().string(from: date)]
        let command = MobileCommand(id: id, type: "request_appointment", deviceTimestamp: Date(), timezone: TimeZone.current.identifier, baseRevision: nil, payload: payload)
        try persistence.enqueue(command)
        if var value = snapshot {
            value = BootstrapData(profiles: value.profiles, pregnancies: value.pregnancies, appointments: value.appointments + [Appointment(id: id, service: service, scheduledAt: date, status: "Pending upload", revision: 0)], kickEvents: value.kickEvents, wardAllocations: value.wardAllocations)
            snapshot = value
        }
        pendingCount = persistence.pendingCount()
        await sync(reason: "appointment")
    }

    func clearLocalData() throws {
        stopForegroundPolling()
        try persistence.clearPatientData()
        snapshot = nil
        cursor = "0"
        lastUpdated = nil
        pendingCount = 0
    }

    private func validAccessToken() async throws -> String {
        guard var current = tokens else { throw APIError.unauthorized }
        if current.expiresAt.timeIntervalSinceNow < 60 {
            current = try await api.refresh(current)
            try KeychainStore.save(current)
            tokens = current
        }
        return current.accessToken
    }

    private func flushOutbox(token: String) async throws {
        for item in persistence.readyCommands() {
            do {
                let command = try APIClient.decoder.decode(MobileCommand.self, from: item.payload)
                try await api.send(command: command, token: token)
                try persistence.complete(item)
            } catch let error as APIError where !error.retryable {
                try persistence.deferCommand(item, error: error.localizedDescription)
            } catch {
                try persistence.deferCommand(item, error: error.localizedDescription)
                throw error
            }
        }
    }

    private func loadBootstrap(token: String) async throws {
        let response = try await api.bootstrap(token: token)
        snapshot = response.data
        cursor = response.cursor
        lastUpdated = response.serverTime
        clockWarning = !PregnancyCalculator.clockSkewIsReasonable(device: Date(), server: response.serverTime)
        try persistence.saveCache(response.data, cursor: response.cursor, at: response.serverTime)
    }

    private func scheduleBackgroundRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: "fj.gov.health.carefiji.refresh")
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }
}
