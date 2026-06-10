export const DEMO_PASSWORD = "Admin247#";

const commonWeakPasswords = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty",
  "qwerty123",
  "admin",
  "admin123",
  "admin1234",
  "letmein",
  "welcome",
  "welcome123",
  "corso123",
  "lbsview123"
]);

export function getPasswordQualityError(password: string) {
  const value = password.trim();

  if (value.length < 8) {
    return "Password must be at least 8 characters.";
  }

  const normalized = value.toLowerCase();
  if (commonWeakPasswords.has(normalized)) {
    return "Choose a stronger password. Avoid common passwords like password123.";
  }

  if (/^\d+$/.test(value)) {
    return "Choose a stronger password with letters, numbers, and symbols.";
  }

  if (/(.)\1{5,}/.test(value)) {
    return "Choose a stronger password that does not repeat one character.";
  }

  return "";
}
