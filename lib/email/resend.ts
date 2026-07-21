const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Corsvent <notifications@corso.ng>";

export type CorsoEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export type CorsoEmailResult = {
  sent: boolean;
  id?: string;
  error?: string;
};

export function isCorsoEmailEnabled() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function corsoEmailFrom() {
  return process.env.CORSO_EMAIL_FROM?.trim() || DEFAULT_FROM;
}

/**
 * Sends an email through Resend. Never throws — email is best-effort and
 * must not break the main operation (user creation, password reset, etc.).
 */
export async function sendCorsoEmail(input: CorsoEmailInput): Promise<CorsoEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { sent: false, error: "RESEND_API_KEY is not configured." };
  }

  const to = (Array.isArray(input.to) ? input.to : [input.to])
    .map((address) => address.trim())
    .filter((address) => address.includes("@"));
  if (!to.length) {
    return { sent: false, error: "No valid recipient email address." };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: corsoEmailFrom(),
        to,
        subject: input.subject,
        html: input.html,
        text: input.text ?? stripHtml(input.html)
      })
    });
    const payload = await response.json().catch(() => null) as { id?: string; message?: string } | null;

    if (!response.ok) {
      return { sent: false, error: payload?.message ?? `Resend request failed (${response.status}).` };
    }

    return { sent: true, id: payload?.id };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "Email request failed." };
  }
}

export type CorsoEmailTemplateInput = {
  heading: string;
  greeting?: string;
  lines: string[];
  /** Label/value rows rendered in a highlighted box (e.g. login details). */
  details?: Array<{ label: string; value: string }>;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
};

/** Simple mobile-friendly branded HTML email. */
export function corsoEmailHtml(input: CorsoEmailTemplateInput) {
  const lines = input.lines
    .map((line) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(line)}</p>`)
    .join("");
  const details = input.details?.length
    ? `<div style="margin:16px 0;padding:14px 16px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;">${input.details
        .map((row) => `<p style="margin:4px 0;font-size:14px;color:#0f172a;"><span style="color:#64748b;">${escapeHtml(row.label)}:</span> <strong>${escapeHtml(row.value)}</strong></p>`)
        .join("")}</div>`
    : "";
  const cta = input.ctaLabel && input.ctaUrl
    ? `<p style="margin:20px 0;"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#0f172a;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${escapeHtml(input.ctaLabel)}</a></p>`
    : "";
  const footer = input.footerNote
    ? `<p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">${escapeHtml(input.footerNote)}</p>`
    : "";
  const greeting = input.greeting
    ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(input.greeting)}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:24px 16px;">
      <div style="background:#0f172a;border-radius:14px 14px 0 0;padding:18px 22px;">
        <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">Corsvent</p>
        <p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">Guest passes and gate check-in, simplified</p>
      </div>
      <div style="background:#ffffff;border-radius:0 0 14px 14px;padding:22px;">
        <h1 style="margin:0 0 14px;font-size:19px;color:#0f172a;">${escapeHtml(input.heading)}</h1>
        ${greeting}
        ${lines}
        ${details}
        ${cta}
        ${footer}
      </div>
      <p style="margin:14px 0 0;text-align:center;font-size:11px;color:#94a3b8;">Sent by Corsvent · event.corso.ng</p>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
