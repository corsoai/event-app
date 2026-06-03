import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function money(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(amount);
}

export function makeAccessCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const DEFAULT_ESTATE_NAME = "LBS View Estate";

export function sortEstatesWithDefaultFirst<T extends { name: string }>(estates: T[]) {
  return [...estates].sort((left, right) => {
    const leftIsDefault = left.name.trim().toLowerCase() === DEFAULT_ESTATE_NAME.toLowerCase();
    const rightIsDefault = right.name.trim().toLowerCase() === DEFAULT_ESTATE_NAME.toLowerCase();

    if (leftIsDefault && !rightIsDefault) {
      return -1;
    }

    if (!leftIsDefault && rightIsDefault) {
      return 1;
    }

    return left.name.localeCompare(right.name);
  });
}

export function makeDigitalIdNumber(input: {
  id: string;
  houseNumber: string;
  phone?: string;
  estateCode?: string;
}) {
  const estateCode = (input.estateCode || "LBS").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 4) || "LBS";
  const unitCode = input.houseNumber.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 5) || "UNIT";
  const seed = `${input.id}:${input.houseNumber}:${input.phone || ""}`;
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 10000;
  }

  return `${estateCode}-${unitCode}-${String(hash).padStart(4, "0")}`;
}

export function normalizePhoneNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("0")) {
    return `234${digits.slice(1)}`;
  }

  return digits;
}

export function phoneAuthEmail(phone: string) {
  const digits = normalizePhoneNumber(phone);
  return digits ? `phone.${digits}@corso.local` : "";
}

export function isPhoneAuthEmail(email: string) {
  return /^phone\.\d+@corso\.local$/i.test(email.trim());
}

export function loginIdentifierToEmail(identifier: string) {
  const trimmed = identifier.trim().toLowerCase();
  return trimmed.includes("@") ? trimmed : phoneAuthEmail(trimmed);
}

export function contactLabel(email: string, phone?: string) {
  if (phone) {
    return phone;
  }

  return isPhoneAuthEmail(email) ? "Phone login" : email;
}
