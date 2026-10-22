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
}
