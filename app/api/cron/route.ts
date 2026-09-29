import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail, expiryWarningEmail, planExpiredEmail } from "@/lib/mailer";

// Called daily by Supabase pg_cron or Vercel Cron
// Supabase SQL: SELECT cron.schedule('check-plan-expiry','0 1 * * *','SELECT net.http_post(url := ''https://your-domain/api/cron/check-plan-expiry'', body := ''{}''::jsonb);');

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  // Secure with secret header
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const now = new Date();
  const results: string[] = [];

  // ─── 1. Expire subscriptions past their end date ───
  const { data: expiredSubs } = await adminClient
    .from("org_subscriptions")
    .select("id, college_id, plans(name)")
    .in("status", ["active", "trial", "grace"])
    .lt("current_period_end", now.toISOString());

  for (const sub of expiredSubs ?? []) {
    await adminClient
      .from("org_subscriptions")
      .update({ status: "expired", updated_at: now.toISOString() })
      .eq("id", sub.id);

    await adminClient
      .from("colleges")
      .update({ is_frozen: true, frozen_reason: "plan_expired", frozen_at: now.toISOString() })
      .eq("id", sub.college_id);

    // Get admin email
    const { data: admin } = await adminClient
      .from("profiles")
      .select("id, display_name, colleges(name, contact_email)")
      .eq("college_id", sub.college_id)
      .eq("role", "college_admin")
      .limit(1)
      .maybeSingle();

    let adminEmail = (admin?.colleges as any)?.contact_email;
    if (admin?.id) {
      const { data: authUser } = await adminClient.auth.admin.getUserById(admin.id);
      if (authUser?.user?.email) adminEmail = authUser.user.email;
    }

    if (adminEmail) {
      await sendMail({
        to: adminEmail,
        subject: "🔒 Your ReportAndFix plan has expired",
        html: planExpiredEmail({
          orgName: (admin?.colleges as any)?.name ?? sub.college_id,
          adminName: admin?.display_name ?? "Admin",
          renewUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://reportandfix.com"}/admin/billing`,
        }),
      });
    }

    await adminClient.from("plan_notifications").insert({
      college_id: sub.college_id,
      type: "plan_expired",
      title: "Your plan has expired",
      body: "All operations are paused. Renew your plan to restore access.",
    });

    results.push(`Expired: ${sub.college_id}`);
  }

  // ─── 2. Send expiry warnings (15d, 7d, 3d, 1d) ───
  const warningDays = [15, 7, 3, 1];
  for (const days of warningDays) {
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() + days);
    windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setHours(23, 59, 59, 999);

    const { data: warnSubs } = await adminClient
      .from("org_subscriptions")
      .select("id, college_id, current_period_end, plans(name)")
      .eq("status", "active")
      .gte("current_period_end", windowStart.toISOString())
      .lte("current_period_end", windowEnd.toISOString());

    for (const sub of warnSubs ?? []) {
      const notifType = `expiry_warning_${days}d` as any;

      // Skip if already sent
      const { data: existing } = await adminClient
        .from("plan_notifications")
        .select("id")
        .eq("college_id", sub.college_id)
        .eq("type", notifType)
        .maybeSingle();
      if (existing) continue;

      const { data: admin } = await adminClient
        .from("profiles")
        .select("id, display_name, colleges(name, contact_email)")
        .eq("college_id", sub.college_id)
        .eq("role", "college_admin")
        .limit(1)
        .maybeSingle();

      let adminEmail = (admin?.colleges as any)?.contact_email;
      if (admin?.id) {
        const { data: authUser } = await adminClient.auth.admin.getUserById(admin.id);
        if (authUser?.user?.email) adminEmail = authUser.user.email;
      }

      if (adminEmail) {
        await sendMail({
          to: adminEmail,
          subject: `⚠️ Your plan expires in ${days} day${days > 1 ? "s" : ""}`,
          html: expiryWarningEmail({
            orgName: (admin?.colleges as any)?.name ?? sub.college_id,
            adminName: admin?.display_name ?? "Admin",
            daysLeft: days,
            planName: (sub.plans as any)?.name ?? "Plan",
            renewUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://reportandfix.com"}/admin/billing`,
          }),
        });
      }

      await adminClient.from("plan_notifications").insert({
        college_id: sub.college_id,
        type: notifType,
        title: `Plan expires in ${days} day${days > 1 ? "s" : ""}`,
        body: `Renew your plan before ${new Date(sub.current_period_end).toLocaleDateString()} to avoid interruption.`,
        email_sent: !!adminEmail,
      });

      results.push(`Warning ${days}d: ${sub.college_id}`);
    }
  }

  // ─── 3. Soft-delete data for orgs frozen ≥ 30 days ───
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: frozenOrgs } = await adminClient
    .from("colleges")
    .select("id")
    .eq("is_frozen", true)
    .lte("frozen_at", thirtyDaysAgo.toISOString());

  for (const org of frozenOrgs ?? []) {
    await adminClient
      .from("complaints")
      .update({ deleted_at: now.toISOString() })
      .eq("college_id", org.id)
      .is("deleted_at", null);

    await adminClient.from("plan_notifications").insert({
      college_id: org.id,
      type: "soft_delete_warning",
      title: "Data soft-deleted",
      body: "Your organisation's data has been soft-deleted after 30 days of plan expiry.",
    });

    results.push(`Soft-deleted: ${org.id}`);
  }

  // ─── 4. Permanently purge expired staff messages (24h-72h retention) ───
  const { data: purgedMessages } = await adminClient
    .from("messages")
    .delete()
    .lt("expires_at", now.toISOString())
    .select("id");

  if (purgedMessages && purgedMessages.length > 0) {
    results.push(`Purged ${purgedMessages.length} expired staff messages`);
  }

  return NextResponse.json({ ok: true, results, timestamp: now.toISOString() });
}

// Allow GET for easy manual trigger during testing
export async function GET(req: NextRequest) {
  return POST(req);
}
