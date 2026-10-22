import SwiftUI

private let dateOnlyFormatter: DateFormatter = {
    let value = DateFormatter()
    value.calendar = Calendar(identifier: .gregorian)
    value.locale = Locale(identifier: "en_US_POSIX")
    value.dateFormat = "yyyy-MM-dd"
    return value
}()

struct PatientHeader: View {
    let sync: SyncCoordinator
    var body: some View {
        VStack(spacing: 8) {
            HStack { BrandView(); Spacer(); Text("MS").font(.caption.bold()).foregroundColor(CareColors.darkTeal).frame(width: 38, height: 38).background(Color.teal.opacity(0.12)).clipShape(Circle()).overlay(alignment: .bottomTrailing) { Circle().fill(sync.isOnline ? Color.green : Color.gray).frame(width: 10, height: 10).overlay(Circle().stroke(Color.white, lineWidth: 2)) } }
            HStack(spacing: 12) {
                Label(sync.isOnline ? "Online" : "Offline", systemImage: sync.isOnline ? "wifi" : "wifi.slash")
                if let date = sync.lastUpdated { Text("Updated \(date.formatted(date: .omitted, time: .shortened))") }
                if sync.pendingCount > 0 { Text("\(sync.pendingCount) pending") }
                Spacer()
            }.font(.caption).foregroundColor(.secondary)
        }
    }
}

struct DashboardView: View {
    @ObservedObject var sync: SyncCoordinator
    @State private var simulatedWeek = 26.0
    @State private var kickConfirmation = false

    private var dueDate: Date { sync.snapshot?.pregnancies.first.flatMap { dateOnlyFormatter.date(from: $0.expectedDueDate) } ?? dateOnlyFormatter.date(from: "2027-01-28")! }
    private var actualWeek: Int { PregnancyCalculator.week(dueDate: dueDate) }
    private var week: Int { Int(simulatedWeek) }
    private var day: Int { week * 7 }
    private var remaining: Int { PregnancyCalculator.totalDays - day }
    private var kickCount: Int { sync.snapshot?.kickEvents.count ?? 0 }

    var body: some View {
        NavigationView {
            ScrollView {
                LazyVStack(spacing: 16) {
                    PatientHeader(sync: sync)
                    Image(decorative: "PacificCuff")
                        .resizable()
                        .scaledToFit()
                        .opacity(0.25)
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 4) { Text("Bula Vinaka, Mere! 🌺").font(.title2.bold()).foregroundColor(CareColors.navy); Text("CWM Suva Clinic · Today is feeling peaceful").font(.caption).foregroundColor(.secondary) }
                        Spacer(); Text("W\(actualWeek)").font(.caption.bold()).foregroundColor(CareColors.darkTeal).padding(8).background(Color.teal.opacity(0.1)).clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    PregnancyDayCard(day: day, week: week, kicks: kickCount) {
                        Task {
                            try? await sync.queueKick()
                            kickConfirmation = true
                            try? await Task.sleep(nanoseconds: 1_500_000_000)
                            kickConfirmation = false
                        }
                    }
                    if week == 4 { WeekFourGrowthCard() }
                    GestationCard(week: week, remaining: remaining, dueDate: dueDate)
                    WeekSimulator(week: $simulatedWeek)
                    if sync.clockWarning { Label("Your device clock differs from secure server time. Times will be reconciled during sync.", systemImage: "clock.badge.exclamationmark").font(.footnote).foregroundColor(.orange).padding() }
                }.padding()
            }
            .background(CareColors.background.ignoresSafeArea())
            .navigationBarHidden(true)
            .refreshable { await sync.sync(reason: "pull-to-refresh") }
            .overlay(alignment: .bottom) { if kickConfirmation { Text("Baby kick saved").font(.footnote.bold()).padding(.horizontal, 16).padding(.vertical, 10).background(CareColors.navy).foregroundColor(.white).clipShape(Capsule()).padding(.bottom, 12).transition(.move(edge: .bottom).combined(with: .opacity)) } }
            .animation(.easeOut, value: kickConfirmation)
        }.navigationViewStyle(.stack)
    }
}

struct PregnancyDayCard: View {
    let day: Int
    let week: Int
    let kicks: Int
    let logKick: () -> Void
    private var stage: (image: String, note: String) {
        switch week {
        case ..<12: return ("Stage04", "A tiny beginning takes root.")
        case ..<20: return ("Stage12", "Little fingers and toes are forming.")
        case ..<26: return ("Stage20", "Small movements become more noticeable.")
        case ..<32: return ("Stage26", "Your baby is growing and responding to sound.")
        case ..<37: return ("Stage32", "Growing stronger, with less room to stretch.")
        default: return ("Stage37", "Getting ready for your first hello.")
        }
    }
    var body: some View {
        ZStack(alignment: .topTrailing) {
            LinearGradient(colors: [CareColors.darkTeal, CareColors.teal], startPoint: .topLeading, endPoint: .bottomTrailing)
            VStack(alignment: .leading, spacing: 12) {
                HStack { Text("Week \(week)").font(.headline); Spacer(); Text("Trimester \(week <= 13 ? 1 : week <= 27 ? 2 : 3)").font(.caption.bold()).padding(6).background(Color.white.opacity(0.15)).clipShape(Capsule()) }
                Spacer(minLength: 60)
                Text("Day \(day)").font(.largeTitle.bold())
                Text("of 280 days").font(.subheadline)
                Text(stage.note).font(.subheadline).frame(maxWidth: 190, alignment: .leading).fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 40)
                HStack {
                    Text("Illustrative development stage").font(.caption2)
                    Spacer()
                    Button(action: logKick) { Label("Log Kick \(kicks)", systemImage: "heart.fill").frame(minHeight: 32) }.buttonStyle(.bordered).tint(.white).background(CareColors.navy.opacity(0.6)).clipShape(RoundedRectangle(cornerRadius: 10)).accessibilityHint("Records one baby kick and uploads it when a connection is available")
                }
            }.padding(24).frame(minHeight: 420).foregroundColor(.white)
                .background {
                    GeometryReader { geometry in
                        Image(decorative: stage.image).resizable().scaledToFill().frame(width: geometry.size.width, height: geometry.size.height).clipped()
                        LinearGradient(colors: [CareColors.navy.opacity(0.88), CareColors.darkTeal.opacity(0.38), .clear], startPoint: .leading, endPoint: .trailing)
                    }
                }
        }.clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous)).shadow(color: CareColors.darkTeal.opacity(0.2), radius: 18, y: 10).animation(.easeInOut(duration: 0.3), value: week)
    }
}

struct WeekFourGrowthCard: View {
    private let milestones = [
        "The blastocyst has firmly implanted into the uterine lining.",
        "The amniotic sac and yolk sac are forming.",
        "Cells are differentiating into three germ layers—ectoderm, mesoderm, and endoderm—laying the foundation for the nervous system, organs, skeleton, and muscles."
    ]

    var body: some View {
        CareCard {
            VStack(alignment: .leading, spacing: 14) {
                Text("YOUR BABY THIS WEEK").font(.caption2.bold()).tracking(1.4).foregroundColor(CareColors.darkTeal)
                Text("Week 4: Early Implantation & Embryonic Disc").font(.title3.bold()).foregroundColor(CareColors.navy)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Approx. 1 mm").font(.headline).foregroundColor(CareColors.darkTeal)
                    Text("Comparable to a tiny poppy seed").font(.caption).foregroundColor(.secondary)
                }
                Text("Key milestones").font(.subheadline.bold()).foregroundColor(CareColors.navy)
                ForEach(milestones, id: \.self) { milestone in
                    HStack(alignment: .top, spacing: 9) {
                        Circle().fill(CareColors.teal).frame(width: 6, height: 6).padding(.top, 6)
                        Text(milestone).font(.footnote).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
    }
}

struct GestationCard: View {
    let week: Int
    let remaining: Int
    let dueDate: Date
    var body: some View {
        CareCard {
            VStack(spacing: 16) {
                HStack(spacing: 0) { CareColors.teal.frame(height: 4); CareColors.orange.frame(width: 90, height: 4) }.clipShape(Capsule())
                HStack { Text("♡ MATERNAL GESTATION & EDD").font(.caption.bold()); Spacer(); Text("\(Int(ceil(Double(remaining) / 7))) weeks to go").font(.caption2.bold()).foregroundColor(CareColors.orange).padding(6).background(Color.orange.opacity(0.08)).clipShape(Capsule()) }
                HStack {
                    VStack(alignment: .leading) { Text("Current Week").font(.caption).foregroundColor(.secondary); Text("Week \(week)").font(.title.bold()).foregroundColor(CareColors.navy); Text("Trimester \(week <= 13 ? 1 : week <= 27 ? 2 : 3)").font(.caption.bold()).foregroundColor(CareColors.darkTeal) }
                    Divider()
                    VStack(alignment: .leading) { Text("Remaining to Due Date").font(.caption).foregroundColor(.secondary); Text("\(remaining) days").font(.title.bold()).foregroundColor(CareColors.orange); Text("\(remaining / 7) full weeks left").font(.caption.bold()).foregroundColor(CareColors.darkTeal) }
                }
                VStack(spacing: 6) { HStack { Text("Overall Pregnancy Progress"); Spacer(); Text("\(Int(Double(week) / 40 * 100))% Completed").bold().foregroundColor(CareColors.darkTeal) }.font(.caption); ProgressView(value: Double(week), total: 40).tint(CareColors.teal) }
                HStack { Image(systemName: "flag.fill").foregroundColor(CareColors.orange); VStack(alignment: .leading) { Text("EXPECTED DUE DATE").font(.caption2.bold()).foregroundColor(.secondary); Text(dueDate.formatted(date: .long, time: .omitted)).font(.caption.bold()).foregroundColor(CareColors.navy) }; Spacer() }.padding(12).background(CareColors.background).clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
    }
}

struct WeekSimulator: View {
    @Binding var week: Double
    var body: some View {
        CareCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack { Label("Interactive Week Simulator", systemImage: "slider.horizontal.3").font(.subheadline.bold()); Spacer(); Text("LIVE SANDBOX").font(.system(size: 8, weight: .bold)).padding(5).background(Color.teal.opacity(0.12)).clipShape(RoundedRectangle(cornerRadius: 5)) }
                Text("Slide to preview pregnancy metrics across all stages.").font(.caption).foregroundColor(.secondary)
                HStack { Text("Week 4"); Spacer(); Text("Week \(Int(week))").bold().foregroundColor(CareColors.darkTeal); Spacer(); Text("Week 40") }.font(.caption)
                Slider(value: $week, in: 4...40, step: 1).tint(CareColors.teal).accessibilityLabel("Pregnancy week preview").accessibilityValue("Week \(Int(week))")
            }
        }
    }
}

struct JourneyView: View {
    @ObservedObject var sync: SyncCoordinator
    var body: some View { NavigationView { List { Section("Your journey") { Label("Pregnancy timeline available offline", systemImage: "checkmark.circle.fill"); Label("Baby development milestones", systemImage: "heart.text.square"); Label("Device dates reconcile with secure server time", systemImage: "clock.arrow.2.circlepath") } }.navigationTitle("My Journey").refreshable { await sync.sync(reason: "journey-refresh") } }.navigationViewStyle(.stack) }
}

struct AppointmentsView: View {
    @ObservedObject var sync: SyncCoordinator
    @State private var showingRequest = false
    var body: some View {
        NavigationView {
            List {
                if let appointments = sync.snapshot?.appointments, !appointments.isEmpty { ForEach(appointments.sorted { $0.scheduledAt < $1.scheduledAt }) { item in VStack(alignment: .leading) { Text(item.service).font(.headline); Text(item.scheduledAt.formatted(date: .abbreviated, time: .shortened)); Text(item.status).font(.caption.bold()).foregroundColor(item.status == "Pending upload" ? .orange : CareColors.darkTeal) } } }
                else { Text("No appointments are currently available.").foregroundColor(.secondary) }
            }
            .navigationTitle("Appointments")
            .toolbar { ToolbarItem(placement: .navigationBarTrailing) { Button { showingRequest = true } label: { Image(systemName: "plus") }.accessibilityLabel("Request appointment") } }
            .sheet(isPresented: $showingRequest) { AppointmentRequestView(sync: sync, isPresented: $showingRequest) }
            .refreshable { await sync.sync(reason: "appointments-refresh") }
        }.navigationViewStyle(.stack)
    }
}

struct AppointmentRequestView: View {
    @ObservedObject var sync: SyncCoordinator
    @Binding var isPresented: Bool
    @State private var service = "Antenatal"
    @State private var date = Date().addingTimeInterval(86_400)
    var body: some View {
        NavigationView {
            Form { Picker("Service", selection: $service) { ForEach(["Antenatal", "Ultrasound", "Postnatal", "Delivery planning"], id: \.self, content: Text.init) }; DatePicker("Date and time", selection: $date, in: Date()...) }
                .navigationTitle("Request appointment")
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { isPresented = false } }; ToolbarItem(placement: .confirmationAction) { Button("Submit") { Task { try? await sync.queueAppointment(service: service, date: date); isPresented = false } } } }
        }.navigationViewStyle(.stack)
    }
}

struct WardsView: View {
    @ObservedObject var sync: SyncCoordinator
    var body: some View {
        NavigationView { ScrollView { VStack(spacing: 18) { if let ward = sync.snapshot?.wardAllocations.first { CareCard { HStack { Image(systemName: "building.2.fill").font(.largeTitle).foregroundColor(CareColors.orange); VStack(alignment: .leading) { Text("PLANNED BIRTH LOCATION").font(.caption2.bold()); Text(ward.facilityName).font(.title3.bold()); Text(ward.wardName ?? ward.status).foregroundColor(.secondary) }; Spacer() } } } else { CareCard { VStack { Image(systemName: "bed.double.fill").font(.largeTitle).foregroundColor(CareColors.orange); Text("CWM Suva Maternity").font(.title3.bold()); Text("Your ward will be confirmed closer to admission.").foregroundColor(.secondary).multilineTextAlignment(.center) } } } }.padding() }.background(CareColors.background).navigationTitle("My Maternity Ward").refreshable { await sync.sync(reason: "wards-refresh") } }.navigationViewStyle(.stack)
    }
}

struct MenuView: View {
    @ObservedObject var model: AppModel
    @ObservedObject var sync: SyncCoordinator
    var body: some View {
        NavigationView { List { Section("Synchronization") { LabeledContentCompat(label: "Connection", value: sync.isOnline ? "Online" : "Offline"); LabeledContentCompat(label: "Pending uploads", value: "\(sync.pendingCount)"); Button("Sync now") { Task { await sync.sync(reason: "menu-manual") } } }; Section("CareFiji") { Button("Sign out", role: .destructive) { model.signOut() } } }.navigationTitle("Menu") }.navigationViewStyle(.stack)
    }
}

struct LabeledContentCompat: View {
    let label: String
    let value: String
    var body: some View { HStack { Text(label); Spacer(); Text(value).foregroundColor(.secondary) } }
}
