import CoreData
import Foundation

final class CacheEntity: NSManagedObject {
    @NSManaged var id: String
    @NSManaged var payload: Data
    @NSManaged var cursor: String
    @NSManaged var lastSync: Date?
}

final class PendingCommandEntity: NSManagedObject {
    @NSManaged var id: UUID
    @NSManaged var payload: Data
    @NSManaged var createdAt: Date
    @NSManaged var retryCount: Int32
    @NSManaged var nextAttemptAt: Date
    @NSManaged var lastError: String?
}

final class PersistenceController {
    static let shared = PersistenceController()
    let container: NSPersistentContainer

    init(inMemory: Bool = false) {
        let model = NSManagedObjectModel()
        let cache = NSEntityDescription()
        cache.name = "CacheEntity"
        cache.managedObjectClassName = NSStringFromClass(CacheEntity.self)
        cache.properties = [
            Self.attribute("id", .stringAttributeType, optional: false),
            Self.attribute("payload", .binaryDataAttributeType, optional: false),
            Self.attribute("cursor", .stringAttributeType, optional: false),
            Self.attribute("lastSync", .dateAttributeType, optional: true)
        ]
        cache.uniquenessConstraints = [["id"]]

        let pending = NSEntityDescription()
        pending.name = "PendingCommandEntity"
        pending.managedObjectClassName = NSStringFromClass(PendingCommandEntity.self)
        pending.properties = [
            Self.attribute("id", .UUIDAttributeType, optional: false),
            Self.attribute("payload", .binaryDataAttributeType, optional: false),
            Self.attribute("createdAt", .dateAttributeType, optional: false),
            Self.attribute("retryCount", .integer32AttributeType, optional: false),
            Self.attribute("nextAttemptAt", .dateAttributeType, optional: false),
            Self.attribute("lastError", .stringAttributeType, optional: true)
        ]
        pending.uniquenessConstraints = [["id"]]
        model.entities = [cache, pending]

        container = NSPersistentContainer(name: "CareFiji", managedObjectModel: model)
        if inMemory { container.persistentStoreDescriptions.first?.url = URL(fileURLWithPath: "/dev/null") }
        container.persistentStoreDescriptions.first?.setOption(true as NSNumber, forKey: NSPersistentHistoryTrackingKey)
        container.loadPersistentStores { _, error in
            precondition(error == nil, "Core Data failed to load: \(error?.localizedDescription ?? "unknown")")
        }
        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    }

    private static func attribute(_ name: String, _ type: NSAttributeType, optional: Bool) -> NSAttributeDescription {
        let value = NSAttributeDescription()
        value.name = name
        value.attributeType = type
        value.isOptional = optional
        return value
    }

    func loadCache() -> (BootstrapData, String, Date?)? {
        let request = NSFetchRequest<CacheEntity>(entityName: "CacheEntity")
        request.predicate = NSPredicate(format: "id == %@", "patient")
        guard let item = try? container.viewContext.fetch(request).first,
              let snapshot = try? APIClient.decoder.decode(BootstrapData.self, from: item.payload) else { return nil }
        return (snapshot, item.cursor, item.lastSync)
    }

    func saveCache(_ snapshot: BootstrapData, cursor: String, at date: Date) throws {
        let context = container.viewContext
        let request = NSFetchRequest<CacheEntity>(entityName: "CacheEntity")
        request.predicate = NSPredicate(format: "id == %@", "patient")
        let item = try context.fetch(request).first ?? CacheEntity(context: context)
        item.id = "patient"
        item.payload = try APIClient.encoder.encode(snapshot)
        item.cursor = cursor
        item.lastSync = date
        try context.save()
    }

    func enqueue(_ command: MobileCommand) throws {
        let item = PendingCommandEntity(context: container.viewContext)
        item.id = command.id
        item.payload = try APIClient.encoder.encode(command)
        item.createdAt = command.deviceTimestamp
        item.retryCount = 0
        item.nextAttemptAt = Date()
        try container.viewContext.save()
    }

    func readyCommands(now: Date = Date()) -> [PendingCommandEntity] {
        let request = NSFetchRequest<PendingCommandEntity>(entityName: "PendingCommandEntity")
        request.predicate = NSPredicate(format: "nextAttemptAt <= %@", now as NSDate)
        request.sortDescriptors = [NSSortDescriptor(key: "createdAt", ascending: true)]
        return (try? container.viewContext.fetch(request)) ?? []
    }

    func pendingCount() -> Int {
        (try? container.viewContext.count(for: NSFetchRequest<NSFetchRequestResult>(entityName: "PendingCommandEntity"))) ?? 0
    }

    func complete(_ item: PendingCommandEntity) throws {
        container.viewContext.delete(item)
        try container.viewContext.save()
    }

    func deferCommand(_ item: PendingCommandEntity, error: String) throws {
        item.retryCount += 1
        item.lastError = error
        item.nextAttemptAt = Date().addingTimeInterval(RetryPolicy.delay(attempt: Int(item.retryCount)))
        try container.viewContext.save()
    }

    func clearPatientData() throws {
        for entity in ["CacheEntity", "PendingCommandEntity"] {
            let request = NSFetchRequest<NSFetchRequestResult>(entityName: entity)
            let delete = NSBatchDeleteRequest(fetchRequest: request)
            try container.persistentStoreCoordinator.execute(delete, with: container.viewContext)
        }
        container.viewContext.reset()
    }
}
