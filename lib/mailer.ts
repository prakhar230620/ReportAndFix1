// lib/mailer.ts
// Dual email engine: Resend (preferred if RESEND_API_KEY configured) or SMTP (nodemailer fallback)

import nodemailer from "nodemailer";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "ReportAndFix Platform <notifications@reportandfix.com>";

const smtpUser = process.env.SMTP_USER || process.env.SMTP_USERNAME || "";
const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "";
const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpFrom =
  process.env.SMTP_FROM && !process.env.SMTP_FROM.includes("@reportandfix.com")
    ? process.env.SMTP_FROM
    : smtpUser || "prakharbankhede15@gmail.com";

let transporter: any = null;
if (smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465 || process.env.SMTP_SECURE === "true",
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      rejectUnauthorized: false, // Prevents certificate chain issues on local dev / corporate networks
    },
  });
}

export type MailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
};

export async function sendMail(options: MailOptions): Promise<{ ok: boolean; error?: string }> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  // 1. Try Resend if API key is provided
  if (RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: recipients,
          subject: options.subject,
          html: options.html,
          reply_to: options.replyTo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("[mailer:resend] API error:", data);
        // If Resend failed and SMTP is available, continue to fallback below
        if (!transporter) return { ok: false, error: data?.message || "Resend error" };
      } else {
        return { ok: true };
      }
    } catch (err: any) {
      console.error("[mailer:resend] Request error:", err?.message);
      if (!transporter) return { ok: false, error: err?.message };
    }
  }

  // 2. SMTP fallback using Nodemailer
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"ReportAndFix Platform" <${smtpFrom}>`,
        to: recipients.join(", "),
        subject: options.subject,
        html: options.html,
        replyTo: options.replyTo,
      });
      return { ok: true };
    } catch (err: any) {
      console.error("[mailer:smtp]", err?.message);
      return { ok: false, error: err?.message };
    }
  }

  console.warn("[mailer] No email transport configured (missing RESEND_API_KEY and SMTP credentials)");
  return { ok: false, error: "No email transport configured" };
}

/** Pre-built templates */
export function expiryWarningEmail(params: {
  orgName: string;
  adminName: string;
  daysLeft: number;
  planName: string;
  renewUrl: string;
}): string {
  return `
  <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
    <div style="background:#1c1917;border-radius:8px;padding:20px 24px;margin-bottom:24px">
      <h1 style="color:#fff;font-size:20px;margin:0">ReportAndFix</h1>
    </div>
    <h2 style="font-size:18px;color:#111827;margin:0 0 8px">
      ⚠️ Your plan expires in ${params.daysLeft} day${params.daysLeft !== 1 ? "s" : ""}
    </h2>
    <p style="color:#4b5563;font-size:14px;margin:0 0 16px">
      Hi ${params.adminName}, your <strong>${params.orgName}</strong> subscription (<strong>${params.planName}</strong>) will expire soon.
    </p>
    <p style="color:#4b5563;font-size:14px;margin:0 0 24px">
      If not renewed, all operations for your organisation will be paused — complaints, worker assignments, and verifications.
    </p>
    <a href="${params.renewUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
      Renew Now →
    </a>
    <p style="color:#9ca3af;font-size:12px;margin:24px 0 0">
      This is an automated message from the ReportAndFix platform. Please do not reply directly.
    </p>
  </div>`;
}

export function paymentSuccessEmail(params: {
  orgName: string;
  adminName: string;
  planName: string;
  amount: string;
  invoiceNumber: string;
  periodEnd: string;
}): string {
  return `
  <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
    <div style="background:#1c1917;border-radius:8px;padding:20px 24px;margin-bottom:24px">
      <h1 style="color:#fff;font-size:20px;margin:0">ReportAndFix</h1>
    </div>
    <h2 style="font-size:18px;color:#111827;margin:0 0 8px">✅ Payment Successful</h2>
    <p style="color:#4b5563;font-size:14px;margin:0 0 16px">
      Hi ${params.adminName}, your payment of <strong>${params.amount}</strong> for <strong>${params.planName}</strong> plan has been received.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 24px">
      <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #f3f4f6">Invoice</td><td style="padding:8px;font-weight:600;border-bottom:1px solid #f3f4f6">${params.invoiceNumber}</td></tr>
      <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #f3f4f6">Organisation</td><td style="padding:8px;font-weight:600;border-bottom:1px solid #f3f4f6">${params.orgName}</td></tr>
      <tr><td style="padding:8px;color:#6b7280">Valid until</td><td style="padding:8px;font-weight:600">${params.periodEnd}</td></tr>
    </table>
    <p style="color:#9ca3af;font-size:12px">This is an automated receipt from ReportAndFix platform.</p>
  </div>`;
}

export function planExpiredEmail(params: {
  orgName: string;
  adminName: string;
  renewUrl: string;
}): string {
  return `
  <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #fca5a5">
    <div style="background:#7f1d1d;border-radius:8px;padding:20px 24px;margin-bottom:24px">
      <h1 style="color:#fff;font-size:20px;margin:0">ReportAndFix</h1>
    </div>
    <h2 style="font-size:18px;color:#991b1b;margin:0 0 8px">🔒 Your Plan Has Expired</h2>
    <p style="color:#4b5563;font-size:14px;margin:0 0 16px">
      Hi ${params.adminName}, your <strong>${params.orgName}</strong> subscription has expired. All operations are now paused.
    </p>
    <p style="color:#4b5563;font-size:14px;margin:0 0 8px">
      Your data will be retained for 30 days. Please renew immediately to restore access.
    </p>
    <a href="${params.renewUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:12px">
      Renew Now →
    </a>
  </div>`;
}
