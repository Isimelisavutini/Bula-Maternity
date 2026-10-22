import XCTest
@testable import CareFiji

final class CareFijiTests: XCTestCase {
    func testPregnancyWeekUsesDeviceCalendar() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 12 * 3600)!
        let due = ISO8601DateFormatter().date(from: "2027-01-28T00:00:00Z")!
        let now = calendar.date(byAdding: .day, value: -98, to: due)!
        XCTAssertEqual(PregnancyCalculator.week(dueDate: due, now: now, calendar: calendar), 26)
        XCTAssertEqual(PregnancyCalculator.daysPassed(dueDate: due, now: now, calendar: calendar), 182)
    }

    func testClockSkewBoundary() {
        let server = Date(timeIntervalSince1970: 1_000)
        XCTAssertTrue(PregnancyCalculator.clockSkewIsReasonable(device: server.addingTimeInterval(300), server: server))
        XCTAssertFalse(PregnancyCalculator.clockSkewIsReasonable(device: server.addingTimeInterval(301), server: server))
    }

    func testRetryBackoffIsBounded() {
        XCTAssertEqual(RetryPolicy.delay(attempt: 0), 1)
        XCTAssertEqual(RetryPolicy.delay(attempt: 3), 8)
        XCTAssertEqual(RetryPolicy.delay(attempt: 20), 300)
    }

    func testCommandEncodingPreservesOfflineTimestamp() throws {
        let command = MobileCommand(id: UUID(), type: "log_kick", deviceTimestamp: Date(timeIntervalSince1970: 500), timezone: "Pacific/Fiji", baseRevision: nil, payload: [:])
        let decoded = try APIClient.decoder.decode(MobileCommand.self, from: APIClient.encoder.encode(command))
        XCTAssertEqual(decoded.id, command.id)
        XCTAssertEqual(decoded.deviceTimestamp, command.deviceTimestamp)
        XCTAssertEqual(decoded.timezone, "Pacific/Fiji")
    }

    func testCSharpAndSupabaseTimestampFormatsDecode() throws {
        for timestamp in ["2026-10-23T08:00:00Z", "2026-10-23T08:00:00.123Z", "2026-10-23T08:00:00.1234567+00:00"] {
            let json = "{\"serverTime\":\"\(timestamp)\"}"
            let response = try APIClient.decoder.decode(CommandResponse.self, from: Data(json.utf8))
            XCTAssertEqual(response.serverTime.timeIntervalSince1970, 1_792_742_400, accuracy: 1)
        }
    }

    func testCSharpBootstrapAndDeletionCursorContract() throws {
        let bootstrap = """
        {"data":{"profiles":[],"pregnancies":[],"appointments":[],"kick_events":[],"ward_allocations":[],"consent_records":[]},"cursor":"42","serverTime":"2026-10-23T08:00:00.1234567+00:00"}
        """
        let value = try APIClient.decoder.decode(BootstrapResponse.self, from: Data(bootstrap.utf8))
        XCTAssertEqual(value.cursor, "42")
        XCTAssertTrue(value.data.kickEvents.isEmpty)
        let sync = """
        {"changes":[{"sequence":43,"entity_type":"appointments","entity_id":"00000000-0000-0000-0000-000000000001","operation":"delete","payload":{},"changed_at":"2026-10-23T08:00:00Z"}],"cursor":"43","hasMore":false,"serverTime":"2026-10-23T08:00:00.123+00:00"}
        """
        let changes = try APIClient.decoder.decode(SyncResponse.self, from: Data(sync.utf8))
        XCTAssertEqual(changes.changes.first?.operation, "delete")
        XCTAssertEqual(changes.cursor, "43")
        XCTAssertFalse(changes.hasMore)
    }
}
