import Image from "next/image";
import Link from "next/link";
import styles from "./LandingPage.module.css";

const motherSteps = [
  ["Get familiar", "Explore the synthetic patient demo, or use your clinic-registered email in the configured patient portal."],
  ["Follow your journey", "Review pregnancy information and appointments. Check when information was last updated."],
  ["Ask your care team", "In the demo, read the privacy note, complete the safety check, then send a message or voice note."],
];
const hospitalSteps = [
  ["Choose your role", "Explore Midwife, Doctor, Administrator, Receptionist or Finance access with synthetic identities."],
  ["Coordinate care", "Review the role-filtered dashboard, appointments, patients and available workflows."],
  ["Keep the conversation going", "Midwives find questions under Patient Messages, or Messages on mobile."],
];

function Arrow() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

function Brand() {
  return (
    <Link href="/" className={styles.brand} aria-label="CareFiji — Bula Maternity home">
      <Image src="/branding/carefiji-logo.png" alt="" width={78} height={78} sizes="78px" />
      <span>CareFiji<small>BULA MATERNITY</small></span>
    </Link>
  );
}

function CareIcon({ kind }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {kind === "people" ? <><circle cx="24" cy="13" r="6" /><circle cx="9" cy="18" r="4" /><circle cx="39" cy="18" r="4" /><path d="M14 40V29a10 10 0 0 1 20 0v11M3 38v-9a6 6 0 0 1 10-4M45 38v-9a6 6 0 0 0-10-4" /></> : null}
      {kind === "leaf" ? <><path d="M24 41V24M24 30C9 32 5 23 6 13c12 0 19 5 18 17ZM24 25C23 11 32 5 43 5c1 12-7 21-19 20Z" /></> : null}
      {kind === "privacy" ? <><path d="M24 4 41 11v12c0 12-17 21-17 21S7 35 7 23V11L24 4Z" /><rect x="18" y="21" width="12" height="12" rx="2" /><path d="M20 21v-4a4 4 0 0 1 8 0v4M24 26v3" /></> : null}
      {kind === "hospital" ? <><path d="M9 43V10h30v33M4 43h40M19 43V32h10v11M20 18h8M24 14v8M15 27h3M30 27h3" /></> : null}
    </svg>
  );
}

function Steps({ items }) {
  return <ol className={styles.steps}>{items.map(([title, text], index) => (
    <li key={title}><span className={styles.number} aria-hidden="true">0{index + 1}</span><div><h4>{title}</h4><p>{text}</p></div></li>
  ))}</ol>;
}

export default function LandingPage() {
  const year = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Pacific/Fiji" }).format(new Date());
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#main-content">Skip to content</a>
      <header className={styles.topbar}>
        <Brand />
        <nav aria-label="Landing page navigation">
          <a href="#application">The application</a><a href="#mothers">For mothers</a><a href="#hospitals">For hospitals</a>
        </nav>
        <Link className={styles.outline} href="/demo">Explore the demo</Link>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <h1 id="hero-title">A little closer<br />to <em>care.</em><br />Wherever home is.</h1>
            <p>Pregnancy support for mothers.<br />Connected workflows for hospital teams.<br />Designed for the Pacific.</p>
            <div className={styles.actions}><a className={styles.primary} href="#mothers">Mother’s guide</a><a className={styles.outline} href="#hospitals">Hospital guide</a></div>
            <small>Explore with synthetic data. Never enter real patient information in the demo.</small>
          </div>
          <div className={styles.heroArt}>
            <Image src="/marketing/pacific-care.webp" alt="Illustration of a pregnant Pacific Island mother talking with a midwife beside a lagoon." fill sizes="(max-width: 760px) 100vw, 52vw" preload />
          </div>
        </section>
        <section id="application" className={styles.application} aria-labelledby="application-title">
          <div className={styles.container}><h2 id="application-title">One place for the journey ahead.</h2><p>Understand the journey. Prepare for appointments. Stay connected with your care team.</p></div>
        </section>
        <section className={styles.guides} aria-labelledby="guides-title">
          <div className={styles.sectionHeading}><h2 id="guides-title">A clear next step, for everyone.</h2><p>Start with the guide that fits your role.</p></div>
          <div className={styles.guideColumns}>
            <article id="mothers" className={styles.motherGuide} aria-labelledby="mother-title">
              <Image className={styles.guideEmblem} src="/branding/carefiji-logo.png" alt="" width={92} height={92} sizes="92px" />
              <h3 id="mother-title">For mothers</h3>
              <Steps items={motherSteps} />
              <Link className={styles.primary} href="/patient">Open patient portal<Arrow /></Link>
              <Link className={styles.textLink} href="/demo?role=patient">Try the mother demo<Arrow /></Link>
            </article>
            <article id="hospitals" className={styles.hospitalGuide} aria-labelledby="hospital-title">
              <div className={styles.hospitalEmblem}><CareIcon kind="hospital" /></div>
              <h3 id="hospital-title">For hospital teams</h3>
              <Steps items={hospitalSteps} />
              <Link className={styles.navyButton} href="/demo?role=midwife">Explore hospital access<Arrow /></Link>
              <p className={styles.guideNote}>Demonstration access is not a hospital onboarding or clinical-service agreement.</p>
            </article>
          </div>
        </section>
        <section className={styles.pacific} aria-labelledby="pacific-title">
          <div className={styles.container}>
            <div className={styles.pacificIntro}><h2 id="pacific-title">Designed<br />for the Pacific.</h2><p>For mothers, families and care teams across island communities. A familiar visual language, clear next steps and a shared place to start.</p></div>
            <div className={styles.values}>
              <div><span className={styles.valueIcon}><CareIcon kind="people" /></span><h3>People first</h3><p>A familiar care team and clear, approachable information.</p></div>
              <div><span className={`${styles.valueIcon} ${styles.coralIcon}`}><CareIcon kind="leaf" /></span><h3>At your pace</h3><p>Review information and prepare questions before appointments.</p></div>
              <div><span className={styles.valueIcon}><CareIcon kind="privacy" /></span><h3>Privacy matters</h3><p>Consent before demo chat.<br />No real patient details in demonstration accounts.</p></div>
            </div>
          </div>
        </section>
        <section className={styles.access} aria-labelledby="access-title">
          <div className={styles.container}><h2 id="access-title">Take your first look.</h2><div className={styles.actions}><Link className={styles.primary} href="/demo">Explore the demo<Arrow /></Link><Link className={styles.outline} href="/patient">Open patient portal<Arrow /></Link></div><p>The demo is synthetic. Production access requires clinic registration and configured services.<br />Chat is not an emergency service; contact maternity care directly for urgent concerns.</p></div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerTop}><Brand /><nav aria-label="Footer navigation"><a href="#mothers">Mother’s guide</a><a href="#hospitals">Hospital guide</a></nav></div>
        <div className={styles.copyright}><p>© {year} BASA · CareFiji — Bula Maternity. All rights reserved.</p><p>Designed for the Pacific.</p></div>
      </footer>
    </div>
  );
}
