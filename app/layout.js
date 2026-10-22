import "./globals.css";
import "./growth.css";

export const metadata = {
  title: "CareFiji — Bula Maternity",
  description: "Synthetic maternity hospital workflow demonstration"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
