import SwiftUI

enum CareColors {
    static let navy = Color(red: 26 / 255, green: 32 / 255, blue: 44 / 255)
    static let deepNavy = Color(red: 0.02, green: 0.12, blue: 0.18)
    static let teal = Color(red: 13 / 255, green: 122 / 255, blue: 115 / 255)
    static let darkTeal = Color(red: 13 / 255, green: 122 / 255, blue: 115 / 255)
    static let orange = Color(red: 0.94, green: 0.40, blue: 0.20)
    static let background = Color(red: 250 / 255, green: 248 / 255, blue: 245 / 255)
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
