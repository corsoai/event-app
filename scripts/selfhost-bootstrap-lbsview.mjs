import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const previewPath = process.argv[2] || ".local-import/lbsview-onboarding-preview.json";
const estateId = process.env.CORSO_BOOTSTRAP_ESTATE_ID || "lbsview-estate";
const estateName = process.env.CORSO_BOOTSTRAP_ESTATE_NAME || "LBS View Estate";

loadEnv(".env.local");

const endpoint = requiredEnv("APPWRITE_ENDPOINT").replace(/\/+$/g, "");
const projectId = requiredEnv("APPWRITE_PROJECT_ID");
const databaseId = requiredEnv("APPWRITE_DATABASE_ID");
const apiKey = requiredEnv("CORSO_APPWRITE_API_KEY");
const headers = {
  "Content-Type": "application/json",
  "X-Appwrite-Project": projectId,
  "X-Appwrite-Key": apiKey,
  "X-Appwrite-Response-Format": "1.9.5"
};

const sourceRows = JSON.parse(readFileSync(previewPath, "utf8"));
const { plan, skippedRows } = buildPlan(sourceRows);
const now = new Date().toISOString();
const today = now.slice(0, 10);

await upsertRow("estates", estateId, {
  name: estateName,
  address: `${estateName}, Lagos`,
  contactEmail: "admin@lbsviewestate.example",
  contactPhone: "+234 801 111 2040",
  gateName: "Main Gate A",
  createdAt: now,
  updatedAt: now
});

for (const row of uniqueBy(plan, (item) => item.propertyId)) {
  const source = row.source;
  await upsertRow("properties", row.propertyId, {
    estateId,
    propertyCode: row.propertyCode,
    name: source.propertyName || row.propertyCode,
    description: source.legacyProperty || "",
    street: "LBS View Estate",
    legacyName: source.legacyProperty || "",
    status: "active",
    createdAt: now,
    updatedAt: now
  });
}

const currentResidentByUnit = new Map();
for (const row of plan) {
  if (normalizeStatus(row.source.residentStatus) === "active" && !currentResidentByUnit.has(row.unitId)) {
    currentResidentByUnit.set(row.unitId, row.residentId);
  }
}

for (const row of uniqueBy(plan, (item) => item.unitId)) {
  const source = row.source;
  await upsertRow("units", row.unitId, {
    estateId,
    propertyId: row.propertyId,
    unitCode: row.unitCode,
    label: row.unitCode,
    apartmentType: source.apartmentType || "Pending classification",
    status: currentResidentByUnit.has(row.unitId) ? "occupied" : "vacant",
    currentResidentId: currentResidentByUnit.get(row.unitId),
    legacyName: source.legacyAddress || source.legacyProperty || "",
    createdAt: now,
    updatedAt: now
  });
}

for (const row of plan) {
  const source = row.source;
  const status = normalizeStatus(source.residentStatus);
  await upsertRow("residents", row.residentId, {
    estateId,
    propertyId: row.propertyId,
    unitId: row.unitId,
    fullName: source.fullName || `Legacy resident row ${source.sourceRow}`,
    phone: normalizePhone(source.phone),
    email: String(source.email || "").trim().toLowerCase(),
    residentType: "tenant",
    status: status === "moved_out" ? "moved_out" : status,
    legacyName: source.legacyName || source.legacyProperty || "",
    legacyAddress: source.legacyAddress || source.legacyProperty || "",
    sourceRow: Number(source.sourceRow),
    openingOutstanding: numberOrZero(source.openingOutstanding),
    expectedMonthly: numberOrZero(source.expectedMonthly),
    onboardingStatus: source.reviewRequired ? "needs_review" : "verified",
    reviewReasons: Array.isArray(source.reviewReasons) ? source.reviewReasons.join(", ") : "",
    createdAt: now,
    updatedAt: now
  });

  await upsertRow("resident_unit_history", safeId("hist", `${row.residentId}:${row.unitId}`), {
    estateId,
    residentId: row.residentId,
    propertyId: row.propertyId,
    unitId: row.unitId,
    unitCode: row.unitCode,
    residentStatus: status,
    source: "legacy_excel_import",
    legacyNote: source.legacyAddress || source.legacyProperty || "",
    createdAt: now,
    updatedAt: now
  });

  if (row.openingBillId) {
    const expectedPayment = numberOrZero(source.expectedPayment);
    const amountPaid = numberOrZero(source.amountPaid);
    const openingOutstanding = numberOrZero(source.openingOutstanding);
    const amount = legacyBillAmount(expectedPayment, amountPaid, openingOutstanding);
    await upsertRow("bills", row.openingBillId, {
      estateId,
      propertyId: row.propertyId,
      unitId: row.unitId,
      residentId: row.residentId,
      category: "Opening balance",
      title: "Opening balance from legacy system",
      amount,
      paidAmount: amountPaid,
      dueDate: today,
      status: billStatus(amount, amountPaid, openingOutstanding),
      createdAt: now,
      updatedAt: now
    });
  }

  if (row.legacyPaymentId) {
    await upsertRow("payments", row.legacyPaymentId, {
      estateId,
      propertyId: row.propertyId,
      unitId: row.unitId,
      residentId: row.residentId,
      billId: row.openingBillId,
      amount: numberOrZero(source.amountPaid),
      reference: `LEGACY-${source.sourceRow}`,
      processor: "manual",
      channel: "bank_transfer",
      providerReference: `legacy-excel-row-${source.sourceRow}`,
      date: today,
      status: "confirmed",
      source: "admin",
      confirmedAt: now,
      confirmedBy: "legacy import",
      createdAt: now,
      updatedAt: now
    });
  }
}

const stanley = plan.find((row) => row.source.fullName === "Stanley Agbonifo");
if (!stanley) {
  throw new Error("Stanley Agbonifo was not found in the import plan.");
}
const stanleyAuth = await ensureAuthUser({
  fullName: "Stanley Agbonifo",
  email: "07033992255@corso.ng",
  phone: "07033992255",
  password: "Admin247#",
  role: "resident",
  houseNumber: "LDI-03-A",
  residentId: stanley.residentId
});

const residentsTotal = (await appwrite(`/tablesdb/${databaseId}/tables/residents/rows`)).total;
const billsTotal = (await appwrite(`/tablesdb/${databaseId}/tables/bills/rows`)).total;
const paymentsTotal = (await appwrite(`/tablesdb/${databaseId}/tables/payments/rows`)).total;

console.log(JSON.stringify({
  importedRows: plan.length,
  skippedRows,
  residentsTotal,
  billsTotal,
  paymentsTotal,
  stanleyResidentId: stanley.residentId,
  stanleyAuthUserId: stanleyAuth.userId,
  stanleyProfileId: stanleyAuth.profileId,
  stanleyLogin: "07033992255",
  stanleyPassword: "Admin247#"
}, null, 2));

function buildPlan(rows) {
  const plan = [];
  let skippedRows = 0;

  for (const original of rows) {
    const row = { ...original };
    const role = String(row.role || "").trim().toLowerCase();
    if (!["resident", "ex resident", "ex-resident"].includes(role)) {
      skippedRows += 1;
      continue;
    }

    if (row.fullName === "Stanley Agbonifo") {
      row.propertyCode = "LDI-03";
      row.propertyName = "LDI-03";
      row.unitCode = "LDI-03-A";
      row.reviewRequired = false;
      row.reviewReasons = [];
    }

    let propertyCode = normalizeCode(row.propertyCode);
    if (!propertyCode || propertyCode === "LDI-REVIEW" || !isApprovedPropertyCode(propertyCode)) {
      propertyCode = "LDI-REVIEW";
    }

    let unitCode = normalizeCode(row.unitCode);
    if (!unitCode) {
      unitCode = `REVIEW-ROW-${String(row.sourceRow).padStart(3, "0")}`;
    }

    const expectedPayment = numberOrZero(row.expectedPayment);
    const amountPaid = numberOrZero(row.amountPaid);
    const openingOutstanding = numberOrZero(row.openingOutstanding);
    plan.push({
      source: row,
      propertyCode,
      unitCode,
      propertyId: safeId("prop", propertyCode),
      unitId: safeId("unit", unitCode),
      residentId: safeId("res", `${row.sourceRow}:${row.fullName}:${row.phone}:${row.email}:${unitCode}`),
      openingBillId: expectedPayment > 0 || openingOutstanding > 0
        ? safeId("bill", `opening:${row.sourceRow}:${unitCode}:${row.fullName}`)
        : undefined,
      legacyPaymentId: amountPaid > 0
        ? safeId("pay", `legacy:${row.sourceRow}:${unitCode}:${row.fullName}`)
        : undefined
    });
  }

  return { plan, skippedRows };
}

async function ensureAuthUser(input) {
  const phone = normalizePhone(input.phone);
  const email = input.email.trim().toLowerCase() || `phone.${phone}@corso.local`;
  const existingPayload = await appwrite(`/users?search=${encodeURIComponent(phone)}`);
  let user = (existingPayload.users || []).find((item) => normalizePhone(item.phone || "") === phone);

  if (!user) {
    user = await appwrite("/users", {
      method: "POST",
      body: {
        userId: safeId("usr", email),
        email,
        phone: appwritePhone(phone),
        password: input.password,
        name: input.fullName.slice(0, 128)
      }
    });
  } else {
    await appwrite(`/users/${encodeURIComponent(user.$id)}/password`, {
      method: "PATCH",
      body: { password: input.password }
    });
    await appwrite(`/users/${encodeURIComponent(user.$id)}/status`, {
      method: "PATCH",
      body: { status: true }
    });
  }

  await appwrite(`/users/${encodeURIComponent(user.$id)}/prefs`, {
    method: "PATCH",
    body: {
      prefs: {
        fullName: input.fullName,
        phone,
        role: input.role,
        estateId,
        estateName,
        houseNumber: input.houseNumber,
        residentId: input.residentId,
        loginIdentifier: phone
      }
    }
  });

  const profileId = safeId("profile", user.$id);
  await upsertRow("profiles", profileId, {
    estateId,
    userId: user.$id,
    fullName: input.fullName,
    email,
    phone,
    role: input.role,
    status: "active",
    houseNumber: input.houseNumber,
    createdAt: now,
    updatedAt: now
  });

  return { userId: user.$id, profileId };
}

async function upsertRow(tableId, rowId, data) {
  const existing = await appwrite(`/tablesdb/${databaseId}/tables/${tableId}/rows/${encodeURIComponent(rowId)}`, {
    allowNotFound: true
  });
  const payload = { data: compact(data), permissions: [] };

  if (existing) {
    return appwrite(`/tablesdb/${databaseId}/tables/${tableId}/rows/${encodeURIComponent(rowId)}`, {
      method: "PATCH",
      body: payload
    });
  }

  return appwrite(`/tablesdb/${databaseId}/tables/${tableId}/rows`, {
    method: "POST",
    body: { rowId, ...payload }
  });
}

async function appwrite(path, options = {}) {
  const response = await fetch(`${endpoint}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (response.status === 404 && options.allowNotFound) {
    return null;
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed: ${JSON.stringify(payload)}`);
  }

  return payload;
}

function loadEnv(path) {
  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const name = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!process.env[name]) {
      process.env[name] = value;
    }
  }
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function safeId(prefix, seed) {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "row";
  const slug = String(seed)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 14);
  const hash = createHash("sha1").update(String(seed)).digest("hex").slice(0, 12);
  return [cleanPrefix, slug, hash].filter(Boolean).join("-").slice(0, 36).replace(/[-_.]+$/g, "");
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "-");
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("0") ? `234${digits.slice(1)}` : digits;
}

function appwritePhone(value) {
  const phone = normalizePhone(value);
  return phone ? `+${phone}` : undefined;
}

function normalizeStatus(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "moved_out") return "moved_out";
  if (normalized === "inactive") return "inactive";
  return "active";
}

function isApprovedPropertyCode(propertyCode) {
  return propertyCode === "JC" || propertyCode === "AA" || /^LDI-\d{2,}$/.test(propertyCode);
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function billStatus(amount, paidAmount, openingOutstanding) {
  if (paidAmount >= amount || (openingOutstanding === 0 && amount === paidAmount)) return "paid";
  if (paidAmount > 0) return "partially_paid";
  return "unpaid";
}

function legacyBillAmount(expectedPayment, amountPaid, openingOutstanding) {
  if (expectedPayment > 0) return expectedPayment;
  if (openingOutstanding > 0 && amountPaid > 0) return openingOutstanding + amountPaid;
  return Math.max(openingOutstanding, amountPaid);
}

function uniqueBy(rows, keyFor) {
  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const key = keyFor(row);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

function compact(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null));
}
