export type MonnifyTransactionMetadata = {
  residentId: string;
  unitCode: string;
  estateId: string;
  months?: number;
  billingPeriod?: string;
};

export type TransactionParams = {
  amount: number;
  customerName: string;
  customerEmail: string;
  paymentReference: string;
  paymentDescription: string;
  redirectUrl: string;
  metadata: MonnifyTransactionMetadata;
};

export type TransactionResponse = {
  checkoutUrl: string;
  transactionReference: string;
  paymentReference: string;
  amount: number;
  status: string;
};

export type VerifiedTransaction = {
  transactionReference: string;
  paymentReference: string;
  amountPaid: number;
  paymentStatus: string;
  paymentMethod: string;
  paidOn?: string;
};

export type ReservedAccountParams = {
  accountReference: string;
  accountName: string;
  customerEmail: string;
  customerName: string;
  bvn?: string;
  metadata: {
    residentId: string;
    unitCode: string;
    estateId: string;
  };
};

export type ReservedAccountResponse = {
  accountNumber: string;
  bankName: string;
  bankCode?: string;
  accountName: string;
  accountReference: string;
  reservationReference: string;
};

type MonnifyConfig = {
  apiKey: string;
  secretKey: string;
  contractCode: string;
  baseUrl: string;
};

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

export async function getMonnifyAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const config = getMonnifyConfig();
  const credentials = Buffer.from(`${config.apiKey}:${config.secretKey}`).toString("base64");
  const response = await fetch(`${config.baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });
  const payload = await parseMonnifyJson(response);
  const body = readResponseBody(payload);
  const accessToken = readString(body, "accessToken");
  const expiresIn = readNumber(body, "expiresIn");

  if (!accessToken) {
    throw new Error("Monnify authentication did not return an access token.");
  }

  tokenCache = {
    accessToken,
    expiresAt: Date.now() + Math.max(300, expiresIn || 3500) * 1000
  };

  return accessToken;
}

export async function initializeTransaction(params: TransactionParams): Promise<TransactionResponse> {
  const config = getMonnifyConfig();
  const accessToken = await getMonnifyAccessToken();
  const response = await fetch(`${config.baseUrl}/api/v1/merchant/transactions/init-transaction`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: params.amount,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      paymentReference: params.paymentReference,
      paymentDescription: params.paymentDescription,
      currencyCode: "NGN",
      contractCode: config.contractCode,
      redirectUrl: params.redirectUrl,
      paymentMethods: ["CARD", "ACCOUNT_TRANSFER", "USSD"],
      metadata: params.metadata
    }),
    cache: "no-store"
  });
  const payload = await parseMonnifyJson(response);
  const body = readResponseBody(payload);
  const checkoutUrl = readString(body, "checkoutUrl");
  const transactionReference = readString(body, "transactionReference");
  const paymentReference = readString(body, "paymentReference") || params.paymentReference;

  if (!checkoutUrl || !transactionReference) {
    throw new Error("Monnify did not return a checkout URL and transaction reference.");
  }

  return {
    checkoutUrl,
    transactionReference,
    paymentReference,
    amount: readNumber(body, "amount") || params.amount,
    status: readString(body, "status") || "initiated"
  };
}

export async function verifyTransaction(transactionReference: string): Promise<VerifiedTransaction> {
  const config = getMonnifyConfig();
  const accessToken = await getMonnifyAccessToken();
  const response = await fetch(`${config.baseUrl}/api/v2/transactions/${encodeURIComponent(transactionReference)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });
  const payload = await parseMonnifyJson(response);
  const body = readResponseBody(payload);

  return {
    transactionReference: readString(body, "transactionReference") || transactionReference,
    paymentReference: readString(body, "paymentReference"),
    amountPaid: readNumber(body, "amountPaid") || readNumber(body, "amount") || 0,
    paymentStatus: readString(body, "paymentStatus") || readString(body, "status"),
    paymentMethod: readString(body, "paymentMethod") || readString(body, "paymentMethodName"),
    paidOn: readString(body, "paidOn")
  };
}

export async function createReservedAccount(params: ReservedAccountParams): Promise<ReservedAccountResponse> {
  const config = getMonnifyConfig();
  const accessToken = await getMonnifyAccessToken();
  const response = await fetch(`${config.baseUrl}/api/v2/bank-transfer/reserved-accounts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      accountReference: params.accountReference,
      accountName: params.accountName,
      currencyCode: "NGN",
      contractCode: config.contractCode,
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      getAllAvailableBanks: true,
      ...(params.bvn ? { bvn: params.bvn } : {}),
      metadata: params.metadata
    }),
    cache: "no-store"
  });
  const payload = await parseMonnifyJson(response);
  const body = readResponseBody(payload);
  const account = readReservedAccount(body);

  if (!account.accountNumber || !account.bankName) {
    throw new Error("Monnify did not return a reserved account number.");
  }

  return {
    accountNumber: account.accountNumber,
    bankName: account.bankName,
    bankCode: account.bankCode,
    accountName: readString(body, "accountName") || account.accountName || params.accountName,
    accountReference: readString(body, "accountReference") || params.accountReference,
    reservationReference: readString(body, "reservationReference") || readString(body, "reservedAccountReference") || params.accountReference
  };
}

function getMonnifyConfig(): MonnifyConfig {
  const apiKey = (process.env.MONNIFY_API_KEY ?? "").trim();
  const secretKey = (process.env.MONNIFY_SECRET_KEY ?? "").trim();
  const contractCode = (process.env.MONNIFY_CONTRACT_CODE ?? "").trim();
  const baseUrl = (process.env.MONNIFY_BASE_URL ?? "https://sandbox.monnify.com").trim().replace(/\/+$/g, "");
  const missing = [
    apiKey ? "" : "MONNIFY_API_KEY",
    secretKey ? "" : "MONNIFY_SECRET_KEY",
    contractCode ? "" : "MONNIFY_CONTRACT_CODE"
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`Monnify configuration is missing: ${missing.join(", ")}`);
  }

  return { apiKey, secretKey, contractCode, baseUrl };
}

async function parseMonnifyJson(response: Response) {
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    throw new Error(monnifyErrorMessage(payload, response.status));
  }

  return payload;
}

function monnifyErrorMessage(payload: unknown, status: number) {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const message = typeof record.responseMessage === "string"
      ? record.responseMessage
      : typeof record.message === "string"
        ? record.message
        : "";
    if (message) {
      return `Monnify request failed: ${message}`;
    }
  }

  return `Monnify request failed with HTTP ${status}.`;
}

function readResponseBody(payload: unknown) {
  if (payload && typeof payload === "object" && "responseBody" in payload) {
    const body = (payload as { responseBody?: unknown }).responseBody;
    if (body && typeof body === "object") {
      return body as Record<string, unknown>;
    }
  }

  return payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function readReservedAccount(record: Record<string, unknown>) {
  const accounts = Array.isArray(record.accounts) ? record.accounts : [];
  const firstAccount = accounts.find((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  const directAccount = firstAccount ?? record;

  return {
    accountNumber: readString(directAccount, "accountNumber"),
    bankName: readString(directAccount, "bankName"),
    bankCode: readString(directAccount, "bankCode"),
    accountName: readString(directAccount, "accountName")
  };
}
