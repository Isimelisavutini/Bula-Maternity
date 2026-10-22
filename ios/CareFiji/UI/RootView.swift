import SwiftUI

struct RootView: View {
    @ObservedObject var model: AppModel

    var body: some View {
        ZStack {
            if model.isAuthenticated { PatientTabView(model: model, sync: model.sync) }
            else { SignInView(model: model) }
            if model.showSplash { SplashView().transition(.opacity.combined(with: .scale(scale: 1.02))).zIndex(20) }
        }
        .animation(.easeOut(duration: 0.45), value: model.showSplash)
        .task {
            try? await Task.sleep(nanoseconds: 2_300_000_000)
            model.showSplash = false
        }
    }
}

struct SplashView: View {
    var body: some View {
        ZStack {
            LinearGradient(colors: [CareColors.navy, CareColors.deepNavy], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            VStack {
                Spacer()
                VStack(spacing: 16) {
                    Image(systemName: "cross.fill").font(.system(size: 46, weight: .black)).foregroundColor(.white).frame(width: 82, height: 82).background(CareColors.teal).clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous)).shadow(color: CareColors.teal.opacity(0.55), radius: 28)
                    Text("CareFiji").font(.system(size: 40, weight: .black, design: .rounded)).foregroundColor(.white)
                    Text("BULA MATERNITY").font(.caption.bold()).tracking(3).foregroundColor(.mint)
                    Text("Care for every beginning. Nurturing mothers & babies across Fiji.").font(.subheadline.weight(.semibold)).foregroundColor(.white.opacity(0.8)).multilineTextAlignment(.center).padding(.top, 4)
                }
                Spacer()
                VStack(spacing: 14) {
                    ProgressView().progressViewStyle(.linear).tint(.mint)
                    Label("Suva Secure Gateway", systemImage: "checkmark.shield").font(.caption).foregroundColor(.white.opacity(0.75))
                }
            }.padding(28)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("CareFiji introduction")
    }
}

struct SignInView: View {
    @ObservedObject var model: AppModel
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    BrandView().padding(.bottom, 20)
                    Text("Welcome back").font(.largeTitle.bold()).foregroundColor(CareColors.navy)
                    Text("Sign in with the verified email address registered to your patient record.").foregroundColor(.secondary)
                    TextField("Email address", text: $model.email).keyboardType(.emailAddress).textContentType(.emailAddress).textInputAutocapitalization(.never).padding().background(Color.white).clipShape(RoundedRectangle(cornerRadius: 12))
                    if model.otpRequested {
                        TextField("Six-digit code", text: $model.otp).keyboardType(.numberPad).textContentType(.oneTimeCode).padding().background(Color.white).clipShape(RoundedRectangle(cornerRadius: 12))
                        Button("Verify and sign in") { Task { await model.verifyOTP() } }.buttonStyle(.borderedProminent).tint(CareColors.teal).frame(maxWidth: .infinity)
                    } else {
                        Button("Send verification code") { Task { await model.requestOTP() } }.buttonStyle(.borderedProminent).tint(CareColors.teal).frame(maxWidth: .infinity)
                    }
                    if let error = model.authError { Text(error).font(.footnote).foregroundColor(.red).accessibilityLabel("Sign in error: \(error)") }
                }.padding(24)
            }.background(CareColors.background.ignoresSafeArea()).navigationBarHidden(true)
        }.navigationViewStyle(.stack)
    }
}

enum PatientTab: Hashable { case dashboard, journey, appointments, wards, menu }

struct PatientTabView: View {
    @ObservedObject var model: AppModel
    @ObservedObject var sync: SyncCoordinator
    @State private var selection: PatientTab = .dashboard
    var body: some View {
        TabView(selection: $selection) {
            DashboardView(sync: sync).tag(PatientTab.dashboard).tabItem { Label("Dashboard", systemImage: "square.grid.2x2.fill") }
            JourneyView(sync: sync).tag(PatientTab.journey).tabItem { Label("Journey", systemImage: "heart") }
            AppointmentsView(sync: sync).tag(PatientTab.appointments).tabItem { Label("Appointments", systemImage: "calendar") }
            WardsView(sync: sync).tag(PatientTab.wards).tabItem { Label("Wards", systemImage: "bed.double") }
            MenuView(model: model, sync: sync).tag(PatientTab.menu).tabItem { Label("Menu", systemImage: "line.3.horizontal") }
        }.tint(CareColors.teal)
    }
}
