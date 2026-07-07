import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const baseUrl = "http://localhost:3000";
const edgePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const residentName = "Adaku Agbonifo";
const residentPhone = "+2348102001234";
const residentPhoneDisplay = "2348102001234";
const residentPassword = "AdakuDemo!2026#LBS";
const demoPassword = "Corso@2026!";

async function clearSession(page) {
  await page.goto(baseUrl);
  await page.evaluate(() => {
    localStorage.removeItem("corso_estate_local_db_v1");
    localStorage.removeItem("corso_user");
    document.cookie = "corso_role=; Max-Age=0; path=/";
  });
}

async function login(page, identifier, expectedPath) {
  await page.goto(`${baseUrl}/login`);
  const demoAccount = page.getByText(identifier, { exact: false });
  if (await demoAccount.count()) {
    await demoAccount.click();
  } else {
    await page.getByLabel("Phone number or email").fill(identifier);
  }
  await page.getByLabel("Password").fill(identifier === residentPhone ? residentPassword : demoPassword);
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
    await clearSession(page);

    await page.goto(`${baseUrl}/signup`);
    await page.getByLabel("Full name").fill(residentName);
    await page.getByLabel("Phone number").fill(residentPhone);
    await page.getByLabel("Password").fill(residentPassword);
    await page.getByRole("button", { name: "Submit access request" }).click();
    await page.getByText("Access request submitted").waitFor({ timeout: 10000 });

    await page.goto(`${baseUrl}/login`);
    await page.getByLabel("Phone number or email").fill(residentPhone);
    await page.getByLabel("Password").fill(residentPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByText("waiting for estate admin approval").waitFor({ timeout: 10000 });

    await login(page, "admin@corso.ng", "/admin");
    await page.goto(`${baseUrl}/admin/users`);
    await page.getByText(residentPhoneDisplay, { exact: true }).waitFor({ timeout: 10000 });
    await page.locator("tr", { hasText: residentPhoneDisplay }).getByRole("button", { name: "Approve" }).click();
    await page.waitForTimeout(1200);

    await page.goto(`${baseUrl}/login`);
    await page.evaluate(() => {
      localStorage.removeItem("corso_user");
      document.cookie = "corso_role=; Max-Age=0; path=/";
    });
    await page.getByLabel("Phone number or email").fill(residentPhone);
    await page.getByLabel("Password").fill(residentPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`${baseUrl}/resident`, { timeout: 15000 });
    await page.getByText(`Welcome, ${residentName}`).waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/resident/digital-id`);
    await page.getByRole("heading", { name: residentName }).waitFor({ timeout: 10000 });

    const savedUser = await page.evaluate(() => JSON.parse(localStorage.getItem("corso_user") ?? "{}"));
    assert.equal(savedUser.phone, residentPhoneDisplay);
    assert.equal(savedUser.name, residentName);

    console.log(`Account approval smoke test passed for ${residentPhone}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
