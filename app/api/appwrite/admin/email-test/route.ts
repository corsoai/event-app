import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import { corsoEmailFrom, corsoEmailHtml, isCorsoEmailEnabled, sendCorsoEmail } from "@/lib/email/resend";

const allowedRoles: UserRole[] = ["estate_admin", "super_admin"];

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles });
    const to = request.nextUrl.searchParams.get("to")?.trim() ?? "";

    if (!isCorsoEmailEnabled()) {
      return NextResponse.json({
        enabled: false,
        message: "Email is not configured. Add RESEND_API_KEY to the environment."
      });
    }

    if (!to || !to.includes("@")) {
      return NextResponse.json({
        enabled: true,
        from: corsoEmailFrom(),
        message: "Email is configured. Add ?to=you@example.com to send a test email."
      });
    }

    const result = await sendCorsoEmail({
      to,
      subject: "Corso email test",
      html: corsoEmailHtml({
        heading: "Email is working",
        lines: [
          "This is a test email from your Corso estate management app.",
          `It was requested by an administrator (${context.role}).`
        ],
        footerNote: "No action is needed."
      })
    });

    return NextResponse.json({
      enabled: true,
      from: corsoEmailFrom(),
      sent: result.sent,
      id: result.id ?? null,
      error: result.error ?? null,
      message: result.sent ? `Test email sent to ${to}.` : `Sending failed: ${result.error ?? "unknown error"}`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send test email.";
    const status = error instanceof SessionContextError ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
