import Foundation

struct PatientProfile: Codable, Equatable {
    let id: UUID
    let fullName: String
    let clinicName: String?
    let revision: Int64
}

struct Pregnancy: Codable, Equatable {
    let id: UUID
    let patientId: UUID
    let expectedDueDate: String
    let lmpDate: String?
    let revision: Int64
}

struct Appointment: Codable, Identifiable, Equatable {
    let id: UUID
    let service: String
    let scheduledAt: Date
    let status: String
    let revision: Int64
}

struct KickEvent: Codable, Identifiable, Equatable {
    let id: UUID
    let occurredAt: Date
    let revision: Int64
}

struct WardAllocation: Codable, Identifiable, Equatable {
    let id: UUID
    let facilityName: String
    let wardName: String?
    let status: String
    let revision: Int64
}

struct BootstrapData: Codable, Equatable {
    let profiles: [PatientProfile]
    let pregnancies: [Pregnancy]
    let appointments: [Appointment]
    let kickEvents: [KickEvent]
    let wardAllocations: [WardAllocation]
}

struct BootstrapResponse: Codable {
    let data: BootstrapData
    let cursor: String
    let serverTime: Date
}

struct SyncChange: Codable, Identifiable {
    var id: String { "\(sequence)-\(entityType)-\(entityId)" }
    let sequence: Int64
    let entityType: String
    let entityId: UUID
    let operation: String
}

struct SyncResponse: Codable {
    let changes: [SyncChange]
    let cursor: String
    let hasMore: Bool
    let serverTime: Date
}

struct MobileCommand: Codable, Identifiable {
    let id: UUID
    let type: String
    let deviceTimestamp: Date
    let timezone: String
    let baseRevision: Int64?
    let payload: [String: String]
}

struct SessionTokens: Codable, Equatable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date
}

enum SyncState: Equatable {
    case idle, syncing, offline, failed(String)
}

enum PregnancyCalculator {
    static let totalDays = 280

    static func daysPassed(dueDate: Date, now: Date = Date(), calendar: Calendar = .current) -> Int {
        let start = calendar.date(byAdding: .day, value: -totalDays, to: dueDate) ?? now
        return min(totalDays, max(0, calendar.dateComponents([.day], from: start, to: now).day ?? 0))
    }

    static func week(dueDate: Date, now: Date = Date(), calendar: Calendar = .current) -> Int {
        max(1, min(40, daysPassed(dueDate: dueDate, now: now, calendar: calendar) / 7))
    }

    static func clockSkewIsReasonable(device: Date, server: Date) -> Bool {
        abs(device.timeIntervalSince(server)) <= 300
    }
}

enum RetryPolicy {
    static func delay(attempt: Int) -> TimeInterval {
        min(300, pow(2, Double(max(0, attempt))))
    }
}
