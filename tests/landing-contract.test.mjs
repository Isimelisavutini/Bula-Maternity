import assert from "node:assert/strict";
import test from "node:test";

const origin = process.env.FRONTEND_TEST_URL;

test("public landing page provides guides, access links, copyright and no patient data", { skip: !origin }, async () => {
  const response = await fetch(origin);
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const content of ["A little closer", "One place for the journey ahead.", "For mothers", "For hospital teams", "Designed", "for the Pacific.", "All rights reserved.", "BASA", "Never enter real patient information"]) assert.ok(html.includes(content), content);
  for (const href of ["#mothers", "#hospitals", "/patient", "/demo", "/demo?role=patient", "/demo?role=midwife"]) assert.ok(html.includes(`href="${href}"`), href);
  assert.ok(!html.includes("Mereani Sovaki"));
  assert.ok(html.includes("/marketing/pacific-care.webp") || html.includes("%2Fmarketing%2Fpacific-care.webp"));
});

test("demo entry presets are allowlisted and protected API still requires authentication", { skip: !origin }, async () => {
  for (const [query, expected] of [["patient", "patient"], ["midwife", "midwife"], ["unknown", "admin"], ["patient&role=midwife", "admin"]]) {
    const response = await fetch(`${origin}/demo?role=${query}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes(`\\"initialDemoRole\\":\\"${expected}\\"`), `safe preset for ${query}`);
    assert.ok(html.includes("noindex"));
  }
  assert.equal((await fetch(`${origin}/api/data`)).status, 401);
});
