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
    .select("id, role, college_id, display_name, department_id")
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

  // Fetch staff members and departments for recipient selector
  const [staffResult, deptsResult] = await Promise.all([
    collegeId
      ? adminClient
          .from("profiles")
          .select("id, display_name, role, department_id, departments(name)")
          .eq("college_id", collegeId)
          .in("role", ["college_admin", "dept_admin", "worker"])
          .neq("id", user.id)
          .order("display_name")
      : { data: [] },
    collegeId
      ? adminClient
          .from("departments")
          .select("id, name")
          .eq("college_id", collegeId)
          .eq("suspended", false)
          .order("name")
      : { data: [] },
  ]);

  const staffMembers = (staffResult.data ?? []).map((s: any) => ({
    id: s.id,
    display_name: s.display_name || "Staff Member",
    role: s.role,
    department_id: s.department_id,
    department_name: (s.departments as any)?.name ?? null,
  }));

  const departments = (deptsResult.data ?? []).map((d: any) => ({
    id: d.id,
    name: d.name,
  }));

  // Fetch active non-expired messages
  const now = new Date().toISOString();
  
  // Try querying messages with target columns
  let messages: any[] = [];
  let fetchError = null;

  try {
    let query = adminClient
      .from("messages")
      .select(
        `
        id,
        college_id,
        sender_id,
        recipient_id,
        target_role,
        target_department_id,
        body,
        complaint_id,
        tagged_user_ids,
        expires_at,
        created_at,
        complaint:complaints(id, public_id, title, status)
      `
      )
      .gt("expires_at", now)
      .order("created_at", { ascending: true })
      .limit(100);

    if (profile.role !== "super_admin" && collegeId) {
      query = query.eq("college_id", collegeId);
    }

    const { data: rawMsgs, error } = await query;
    if (error) {
      fetchError = error;
    } else {
      messages = rawMsgs || [];
    }
  } catch (err: any) {
    fetchError = err;
  }

  // Fallback query if recipient_id or target columns don't exist yet in DB
  if (fetchError) {
    let fallbackQuery = adminClient
      .from("messages")
      .select(
        `
        id,
        college_id,
        sender_id,
        body,
        complaint_id,
        tagged_user_ids,
        expires_at,
        created_at,
        complaint:complaints(id, public_id, title, status)
      `
      )
      .gt("expires_at", now)
      .order("created_at", { ascending: true })
      .limit(100);

    if (profile.role !== "super_admin" && collegeId) {
      fallbackQuery = fallbackQuery.eq("college_id", collegeId);
    }

    const { data: rawMsgs, error: fallbackError } = await fallbackQuery;
    if (fallbackError) {
      return NextResponse.json({ error: fallbackError.message }, { status: 500 });
    }
    messages = rawMsgs || [];
  }

  // Populate sender, recipient, and department metadata
  const userIdsToResolve = new Set<string>();
  messages.forEach((m) => {
    if (m.sender_id) userIdsToResolve.add(m.sender_id);
    if (m.recipient_id) userIdsToResolve.add(m.recipient_id);
    if (Array.isArray(m.tagged_user_ids)) {
      m.tagged_user_ids.forEach((id: string) => userIdsToResolve.add(id));
    }
  });

  const { data: resolvedProfiles } = await adminClient
    .from("profiles")
    .select("id, display_name, role")
    .in("id", Array.from(userIdsToResolve));

  const profileMap = new Map((resolvedProfiles ?? []).map((p: any) => [p.id, p]));
  const deptMap = new Map(departments.map((d: any) => [d.id, d.name]));

  const enrichedMessages = messages.map((m: any) => {
    const sender = profileMap.get(m.sender_id) ?? {
      id: m.sender_id,
      display_name: "Staff Member",
      role: "worker",
    };
    const recipient = m.recipient_id
      ? profileMap.get(m.recipient_id) ?? { id: m.recipient_id, display_name: "Staff", role: "worker" }
      : Array.isArray(m.tagged_user_ids) && m.tagged_user_ids.length > 0
      ? profileMap.get(m.tagged_user_ids[0])
      : null;

    const targetDeptName = m.target_department_id ? deptMap.get(m.target_department_id) : null;

    return {
      ...m,
      sender,
      recipient,
      target_department_name: targetDeptName,
    };
  });

  // Filter messages based on recipient access (strictly for staff of this org):
  // - College Admins and Super Admins see all for oversight
  // - Senders always see their sent messages
  // - Direct messages only visible to recipient and sender
  // - Role-targeted messages visible to members of that role
  // - Department-targeted messages visible to staff in that department
  // - "all" messages visible to all staff in this org
  const visibleMessages = enrichedMessages.filter((m: any) => {
    if (profile.role === "super_admin" || profile.role === "college_admin") {
      return true;
    }
    if (m.sender_id === user.id) {
      return true;
    }
    if (m.recipient_id) {
      return m.recipient_id === user.id;
    }
    if (Array.isArray(m.tagged_user_ids) && m.tagged_user_ids.length > 0) {
      return m.tagged_user_ids.includes(user.id);
    }
    if (m.target_role && m.target_role !== "all") {
      return m.target_role === profile.role;
    }
    if (m.target_department_id) {
      return m.target_department_id === profile.department_id;
    }
    return true;
  });

  return NextResponse.json({
    messages: visibleMessages,
    staffMembers,
    departments,
    currentUserId: user.id,
    currentUserRole: profile.role,
    currentUserDeptId: profile.department_id,
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
    .select("id, role, college_id, display_name, department_id")
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
  const recipientId = bodyJson.recipientId ? String(bodyJson.recipientId).trim() : null;
  const targetType = bodyJson.targetType || (recipientId ? "direct" : "all");
  const targetRole = targetType === "role" && bodyJson.targetRole ? String(bodyJson.targetRole) : "all";
  const targetDepartmentId = targetType === "department" && bodyJson.targetDepartmentId ? String(bodyJson.targetDepartmentId).trim() : null;

  const taggedUserIds: string[] = recipientId
    ? [recipientId]
    : Array.isArray(bodyJson.taggedUserIds)
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

  // Attempt insert with target fields
  let insertedMsg: any = null;
  let insertError = null;

  const primaryPayload: Record<string, any> = {
    college_id: collegeId,
    sender_id: user.id,
    body: text,
    complaint_id: complaintId,
    tagged_user_ids: taggedUserIds,
    expires_at: expiresAt.toISOString(),
  };

  if (recipientId) primaryPayload.recipient_id = recipientId;
  if (targetRole && targetRole !== "all") primaryPayload.target_role = targetRole;
  if (targetDepartmentId) primaryPayload.target_department_id = targetDepartmentId;

  try {
    const res = await adminClient
      .from("messages")
      .insert(primaryPayload)
      .select(
        `
        id,
        college_id,
        sender_id,
        recipient_id,
        target_role,
        target_department_id,
        body,
        complaint_id,
        tagged_user_ids,
        expires_at,
        created_at,
        complaint:complaints(id, public_id, title, status)
      `
      )
      .single();

    if (res.error) {
      insertError = res.error;
    } else {
      insertedMsg = res.data;
    }
  } catch (err: any) {
    insertError = err;
  }

  // Fallback insert if columns don't exist yet
  if (insertError) {
    const fallbackRes = await adminClient
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
        sender_id,
        body,
        complaint_id,
        tagged_user_ids,
        expires_at,
        created_at,
        complaint:complaints(id, public_id, title, status)
      `
      )
      .single();

    if (fallbackRes.error) {
      return NextResponse.json({ error: fallbackRes.error.message }, { status: 500 });
    }
    insertedMsg = fallbackRes.data;
  }

  // Fetch recipient details if direct message
  let recipientDetails = null;
  if (recipientId) {
    const { data: recProfile } = await adminClient
      .from("profiles")
      .select("id, display_name, role")
      .eq("id", recipientId)
      .single();
    recipientDetails = recProfile;
  }

  const newMessage = {
    ...insertedMsg,
    sender: {
      id: profile.id,
      display_name: profile.display_name,
      role: profile.role,
    },
    recipient: recipientDetails,
  };

  // Trigger targeted notifications
  if (recipientId) {
    const payload = {
      profile_id: recipientId,
      college_id: collegeId,
      type: "staff_message" as any,
      title: `Direct Staff Message from ${profile.display_name || "Colleague"}`,
      body: `"${text.slice(0, 80)}"`,
      metadata: { message_id: newMessage?.id, complaint_id: complaintId },
    };

    const { error: notifErr } = await adminClient.from("plan_notifications").insert(payload);
    if (notifErr && notifErr.code === "22P02") {
      await adminClient.from("plan_notifications").insert({
        ...payload,
        type: "plan_assigned" as any,
        metadata: { ...payload.metadata, original_type: "staff_message" },
      });
    }
  } else if (taggedUserIds.length > 0) {
    for (const taggedId of taggedUserIds) {
      if (taggedId === user.id) continue;
      const payload = {
        profile_id: taggedId,
        college_id: collegeId,
        type: "staff_message" as any,
        title: "Tagged in Staff Chat",
        body: `${profile.display_name || "A team member"} tagged you: "${text.slice(0, 80)}"`,
        metadata: { message_id: newMessage?.id, complaint_id: complaintId },
      };

      const { error: notifErr } = await adminClient.from("plan_notifications").insert(payload);
      if (notifErr && notifErr.code === "22P02") {
        await adminClient.from("plan_notifications").insert({
          ...payload,
          type: "plan_assigned" as any,
          metadata: { ...payload.metadata, original_type: "staff_message" },
        });
      }
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
