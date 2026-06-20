import { chromium } from "playwright-core";

const baseUrl = "http://localhost:3000";
const edgePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

function lagosDateTime(offsetMinutes = 0) {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(date).map((part) => [part.type, part.value])
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

    await login(page, "resident@corso.ng", "/resident");
    const future = lagosDateTime(60);

    await page.goto(`${baseUrl}/resident/invite-visitor`);
    await page.getByLabel("Visitor name").fill("Future Test Visitor");
    await page.getByLabel("Phone number").fill("+234 800 111 3333");
    await page.getByLabel("Visit date").fill(future.date);
    await page.getByLabel("Expected arrival time").fill(future.time);
    await page.getByRole("button", { name: "Generate visitor code" }).click();
    await page.getByText("Visitor invitation saved locally").waitFor({ timeout: 10000 });
    const visitorCode = (await page.locator("p.font-mono.text-xl").textContent())?.trim() ?? "";

    await login(page, "security@corso.ng", "/security");
    await page.goto(`${baseUrl}/security/verify-visitor`);
    await page.getByLabel("Access code").fill(visitorCode);
    await page.getByRole("button", { name: "Search code" }).click();
    await page.getByText("Check-in opens").first().waitFor({ timeout: 10000 });

    const checkInDisabled = await page.getByRole("button", { name: /Check in/ }).isDisabled();
    if (!checkInDisabled) {
      throw new Error("Future visitor check-in button should be disabled before arrival time.");
    }

    console.log(`Future arrival check-in blocked. Visitor code: ${visitorCode}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
