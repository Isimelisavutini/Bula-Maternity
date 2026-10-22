import SwiftUI

enum CareColors {
    static let navy = Color(red: 0.03, green: 0.23, blue: 0.34)
    static let deepNavy = Color(red: 0.02, green: 0.12, blue: 0.18)
    static let teal = Color(red: 0.03, green: 0.65, blue: 0.65)
    static let darkTeal = Color(red: 0.03, green: 0.42, blue: 0.45)
    static let orange = Color(red: 0.94, green: 0.40, blue: 0.20)
    static let background = Color(red: 0.96, green: 0.98, blue: 0.97)
}

struct CareCard<Content: View>: View {
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }
    var body: some View {
        content.padding(18).background(Color.white).clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous)).shadow(color: CareColors.navy.opacity(0.08), radius: 16, y: 8)
    }
}

struct BrandView: View {
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "cross.fill").font(.title2.bold()).foregroundColor(.white).frame(width: 42, height: 42).background(CareColors.teal).clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
            VStack(alignment: .leading, spacing: 0) {
                Text("CareFiji").font(.title3.bold()).foregroundColor(CareColors.navy)
                Text("BULA MATERNITY").font(.caption2.bold()).tracking(2).foregroundColor(CareColors.darkTeal)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("CareFiji Bula Maternity")
    }
}
