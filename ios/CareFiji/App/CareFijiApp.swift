import BackgroundTasks
import SwiftUI
import UIKit

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: "fj.gov.health.carefiji.refresh", using: nil) { task in
            guard let refresh = task as? BGAppRefreshTask else { task.setTaskCompleted(success: false); return }
            NotificationCenter.default.post(name: .careFijiBackgroundRefresh, object: refresh)
        }
        return true
    }
}

extension Notification.Name { static let careFijiBackgroundRefresh = Notification.Name("CareFijiBackgroundRefresh") }

@main
struct CareFijiApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var model: AppModel

    init() {
        do { _model = StateObject(wrappedValue: AppModel(api: try APIClient())) }
        catch { fatalError("CareFiji configuration error: \(error.localizedDescription)") }
    }

    var body: some Scene {
        WindowGroup {
            RootView(model: model)
                .onChange(of: scenePhase) { phase in
                    if phase == .active, model.isAuthenticated { model.sync.startForegroundPolling() }
                    else if phase == .background { model.sync.stopForegroundPolling() }
                }
                .onReceive(NotificationCenter.default.publisher(for: .careFijiBackgroundRefresh)) { notification in
                    guard let task = notification.object as? BGAppRefreshTask else { return }
                    let work = Task { await model.sync.sync(reason: "background"); task.setTaskCompleted(success: true) }
                    task.expirationHandler = { work.cancel(); task.setTaskCompleted(success: false) }
                }
        }
    }
}
