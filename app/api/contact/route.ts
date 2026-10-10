import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // 1. Insert into database
    const { data: submission, error: dbError } = await adminClient
      .from("contact_submissions")
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject?.trim() || "General Inquiry",
        message: message.trim(),
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("[contact-form] DB Error:", dbError);
    }

    // 2. Alert Super Admin via SMTP
    const adminAlertEmail =
      process.env.ADMIN_ALERT_EMAIL ||
      process.env.SMTP_USER ||
      process.env.SMTP_USERNAME ||
      process.env.SMTP_FROM;

    if (adminAlertEmail && !adminAlertEmail.includes("@reportandfix.com")) {
      await sendMail({
        to: adminAlertEmail,
        subject: `[ReportAndFix Inquiry] ${subject || "New Message"} from ${name}`,
        html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #1e3a8a; margin-top: 0;">New Contact Form Submission</h2>
          <p><strong>Sender:</strong> ${name} &lt;${email}&gt;</p>
          <p><strong>Subject:</strong> ${subject || "General Inquiry"}</p>
          <p><strong>Message:</strong></p>
          <div style="background: #f9fafb; padding: 15px; border-radius: 6px; white-space: pre-wrap; font-size: 14px; color: #374151;">
            ${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
          </div>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">
            Submitted on ${new Date().toLocaleString("en-IN")} via ReportAndFix Platform
          </p>
        </div>
      `,
      });
    }

    // 3. Send automated confirmation to user
    await sendMail({
      to: email,
      subject: `Thank you for contacting ReportAndFix: ${subject || "We received your message"}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-top: 0;">We received your inquiry</h2>
          <p>Hello ${name},</p>
          <p>Thank you for reaching out to the ReportAndFix team. Our administrators have received your message and will review it promptly.</p>
          <div style="margin: 20px 0; padding: 15px; background: #f3f4f6; border-left: 4px solid #2563eb; font-size: 14px;">
            <strong>Your Message:</strong><br />
            ${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
          </div>
          <p style="color: #6b7280; font-size: 14px;">Best regards,<br />The ReportAndFix Platform Team</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true, submissionId: submission?.id });
  } catch (err: any) {
    console.error("[contact-route]", err);
    return NextResponse.json(
      { error: err.message || "Failed to process message." },
      { status: 500 }
    );
  }
}
