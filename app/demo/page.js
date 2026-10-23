import BulaApp from "../ui/BulaApp";

export const metadata = {
  title: "CareFiji — Demonstration workspace",
  description: "Explore synthetic maternity workflows. Never enter real patient information.",
  robots: { index: false, follow: false },
};

export default async function DemoPage({ searchParams }) {
  const role = (await searchParams).role;
  const initialDemoRole = ["patient", "midwife"].includes(role) ? role : "admin";
  return <BulaApp initialDemoRole={initialDemoRole} />;
}
