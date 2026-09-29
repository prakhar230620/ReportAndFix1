import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, role, college_id, display_name")
    .eq("id", user.id)
    .single();

  const isStaff =
    profile &&
    ["college_admin", "dept_admin", "worker", "super_admin"].includes(
      profile.role
    );

  if (!isStaff) {
    return NextResponse.json(
      { error: "Staff messaging is strictly restricted to Admins and Workers." },
      { status: 403 }
    );
  }

  const collegeId = profile.college_id;
  if (!collegeId && profile.role !== "super_admin") {
    return NextResponse.json(
      { error: "No organization assigned." },
      { status: 400 }
    );
  }

  // Check plan messaging feature
  if (profile.role !== "super_admin") {
    const { data: sub } = await adminClient
      .from("org_subscriptions")
      .select("status, plans(slug, messaging_enabled, message_retention_hours)")
      .eq("college_id", collegeId!)
      .maybeSingle();

    const plan = (sub?.plans as any) ?? null;
    const messagingEnabled = plan?.messaging_enabled === true;

    if (!messagingEnabled) {
      return NextResponse.json(
        {
          error:
            "Staff In-App Messaging is only available on Professional and Enterprise plans.",
          upgradeRequired: true,
          plan: plan?.slug ?? "standard",
        },
        { status: 403 }
      );
    }
  }

  // Fetch active non-expired messages
  const now = new Date().toISOString();
  let query = adminClient
    .from("messages")
    .select(
      `
      id,
      college_id,
      body,
      complaint_id,
      tagged_user_ids,
      expires_at,
      created_at,
      sender:profiles(id, display_name, role),
      complaint:complaints(id, public_id, title, status)
    `
    )
    .gt("expires_at", now)
    .order("created_at", { ascending: true })
    .limit(100);

  if (profile.role !== "super_admin" && collegeId) {
    query = query.eq("college_id", collegeId);
  }

  const { data: messages, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    messages: messages ?? [],
    currentUserId: user.id,
    currentUserRole: profile.role,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, role, college_id, display_name")
    .eq("id", user.id)
    .single();

  const isStaff =
    profile &&
    ["college_admin", "dept_admin", "worker", "super_admin"].includes(
      profile.role
    );

  if (!isStaff) {
    return NextResponse.json(
      { error: "Staff messaging is restricted to Admins and Workers." },
      { status: 403 }
    );
  }

  const collegeId = profile.college_id;
  if (!collegeId) {
    return NextResponse.json({ error: "No organization assigned." }, { status: 400 });
  }

  // Verify plan
  let retentionHours = 24;
  if (profile.role !== "super_admin") {
    const { data: sub } = await adminClient
      .from("org_subscriptions")
      .select("status, plans(messaging_enabled, message_retention_hours)")
      .eq("college_id", collegeId)
      .maybeSingle();

    const plan = (sub?.plans as any) ?? null;
    if (!plan?.messaging_enabled) {
      return NextResponse.json(
        { error: "Upgrade plan to use Staff Messaging.", upgradeRequired: true },
        { status: 403 }
      );
    }
    retentionHours = plan.message_retention_hours || 24;
  }

  const bodyJson = await req.json();
  const text = String(bodyJson.body ?? "").trim();
  let complaintId = bodyJson.complaintId ?? null;
  const taggedUserIds: string[] = Array.isArray(bodyJson.taggedUserIds)
    ? bodyJson.taggedUserIds
    : [];

  if (!text) {
    return NextResponse.json({ error: "Message body is required." }, { status: 400 });
  }

  // Auto-detect complaint tag if not explicitly linked (e.g. #CMP-...)
  if (!complaintId) {
    const cmpMatch = text.match(/#?CMP-([a-zA-Z0-9_-]+)/i);
    if (cmpMatch) {
      const publicId = (cmpMatch[0].startsWith("#") ? cmpMatch[0].slice(1) : cmpMatch[0]).toUpperCase();
      const { data: linkedCmp } = await adminClient
        .from("complaints")
        .select("id")
        .eq("college_id", collegeId)
        .ilike("public_id", publicId)
        .maybeSingle();
      if (linkedCmp) {
        complaintId = linkedCmp.id;
      }
    }
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + retentionHours * 60 * 60 * 1000);

  const { data: newMessage, error: insertError } = await adminClient
    .from("messages")
    .insert({
      college_id: collegeId,
      sender_id: user.id,
      body: text,
      complaint_id: complaintId,
      tagged_user_ids: taggedUserIds,
      expires_at: expiresAt.toISOString(),
    })
    .select(
      `
      id,
      college_id,
      body,
      complaint_id,
      tagged_user_ids,
      expires_at,
      created_at,
      sender:profiles(id, display_name, role),
      complaint:complaints(id, public_id, title, status)
    `
    )
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Trigger in-app notifications if users are tagged
  for (const taggedId of taggedUserIds) {
    const payload = {
      profile_id: taggedId,
      college_id: collegeId,
      type: "staff_message" as any,
      title: "Tagged in Staff Chat",
      body: `${profile.display_name || "A team member"} tagged you: "${text.slice(0, 80)}"`,
      metadata: { message_id: newMessage?.id, complaint_id: complaintId },
    };

    const { error: notifErr } = await adminClient.from("plan_notifications").insert(payload);
    // If enum value staff_message is not yet committed to DB, fallback to plan_assigned
    if (notifErr && notifErr.code === "22P02") {
      await adminClient.from("plan_notifications").insert({
        ...payload,
        type: "plan_assigned" as any,
        metadata: { ...payload.metadata, original_type: "staff_message" },
      });
    }
  }

  return NextResponse.json({ ok: true, message: newMessage });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, college_id")
    .eq("id", user.id)
    .single();

  if (!profile || !["college_admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json(
      { error: "Only administrators can delete messages." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("id");

  if (!messageId) {
    return NextResponse.json({ error: "Message ID required." }, { status: 400 });
  }

  let deleteQuery = adminClient.from("messages").delete().eq("id", messageId);
  if (profile.role !== "super_admin") {
    deleteQuery = deleteQuery.eq("college_id", profile.college_id!);
  }

  const { error } = await deleteQuery;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
