import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const baseUrl = "http://localhost:3000";
const edgePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

function currentLagosDateTime() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(new Date()).map((part) => [part.type, part.value])
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`
  };
}

async function login(page, email, expectedPath) {
  await page.goto(`${baseUrl}/login`);
  await page.getByText(email).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${baseUrl}${expectedPath}`, { timeout: 15000 });
}

async function main() {
  const browser = await chromium.launch({
    executablePath: edgePath,
    headless: true
  });
  const page = await browser.newPage();

  try {
    await page.goto(baseUrl);
    await page.evaluate(() => {
      localStorage.removeItem("corso_estate_local_db_v1");
      localStorage.removeItem("corso_user");
      document.cookie = "corso_role=; Max-Age=0; path=/";
    });

    await login(page, "resident@lbsview.test", "/resident");

    await page.goto(`${baseUrl}/resident/invite-visitor`);
    const visitWindow = currentLagosDateTime();
    await page.getByLabel("Visitor name").fill("Local Test Visitor");
    await page.getByLabel("Phone number").fill("+234 800 111 2222");
    await page.getByLabel("Visit date").fill(visitWindow.date);
    await page.getByLabel("Expected arrival time").fill(visitWindow.time);
    await page.getByRole("button", { name: "Generate visitor code" }).click();
    await page.getByText("Visitor invitation saved locally").waitFor({ timeout: 10000 });
    const visitorCode = (await page.locator("p.font-mono.text-xl").textContent())?.trim() ?? "";
    assert.match(visitorCode, /^[0-9]{6}$/, "visitor code should be exactly 6 digits");

    await page.goto(`${baseUrl}/resident/payments`);
    await page.getByLabel("Payment reference").fill("LOCAL-TEST-001");
    await page.getByLabel("Amount").fill("5000");
    await page.getByRole("button", { name: "Submit proof" }).click();
    await page.getByText("LOCAL-TEST-001", { exact: true }).waitFor({ timeout: 10000 });

    await page.goto(`${baseUrl}/resident/new-complaint`);
    await page.getByLabel("Title").fill("Local demo gate light issue");
    await page.getByLabel("Description").fill("The test confirms complaint submission persists locally.");
    await page.getByRole("button", { name: "Submit complaint" }).click();
    await page.getByText("saved locally for admin review").waitFor({ timeout: 10000 });

    await login(page, "security@lbsview.test", "/security");
    await page.goto(`${baseUrl}/security/verify-visitor`);
    await page.getByLabel("Access code").fill(visitorCode);
    await page.getByText("Local Test Visitor").waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "Check in" }).click();
    await page.getByText("Local Test Visitor is now checked-in.").waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "Check out" }).click();
    await page.getByText("Local Test Visitor is now checked-out.").waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/security/logs`);
    await page.getByText(visitorCode).waitFor({ timeout: 10000 });

    await login(page, "admin@lbsview.test", "/admin");
    await page.goto(`${baseUrl}/admin/payments`);
    await page.getByText("LOCAL-TEST-001").waitFor({ timeout: 10000 });
    const paymentRow = page.locator("tr", { hasText: "LOCAL-TEST-001" });
    await paymentRow.getByRole("button", { name: "Confirm" }).click();
    await paymentRow.locator("span.inline-flex", { hasText: "confirmed" }).waitFor({ timeout: 10000 });

    await page.goto(`${baseUrl}/admin/complaints`);
    await page.getByText("Local demo gate light issue").waitFor({ timeout: 10000 });

    console.log(`Local demo smoke test passed. Visitor code: ${visitorCode}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
