import Image from "next/image";

export default function BrandLogo({ compact = false }) {
  return (
    <div className={`dashboard-brand${compact ? " dashboard-brand-compact" : ""}`}>
      <Image
        src="/branding/carefiji-logo.png"
        alt="CareFiji — Bula Maternity"
        width={160}
        height={160}
        sizes={compact ? "84px" : "160px"}
      />
    </div>
  );
}
