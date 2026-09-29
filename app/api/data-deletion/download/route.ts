import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDataExportArchive } from "@/lib/createDataExport";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get("token");
    const requestId = searchParams.get("requestId");

    const adminClient = createAdminClient();

    // Query the deletion request
    let query = adminClient.from("data_deletion_requests").select("*");
    if (token) {
      query = query.eq("download_token", token);
    } else if (requestId) {
      query = query.eq("id", requestId);
    } else {
      return NextResponse.json({ error: "Missing token or requestId" }, { status: 400 });
    }

    const { data: request, error } = await query.maybeSingle();

    if (error || !request) {
      return NextResponse.json({ error: "Deletion request not found" }, { status: 404 });
    }

    // Verify the caller is an admin of the requesting college
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role, college_id")
      .eq("id", user.id)
      .single();

    if (
      !profile ||
      (profile.role !== "college_admin" && profile.role !== "super_admin") ||
      (profile.role === "college_admin" && profile.college_id !== request.college_id)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if approvals are complete
    if (
      request.status === "pending_approvals" &&
      Object.keys(request.approvals_received || {}).length < request.approvals_required
    ) {
      return NextResponse.json({ error: "Not all required admin approvals have been received." }, { status: 400 });
    }

    // Generate archive
    const { zipBuffer, filename } = await createDataExportArchive({
      collegeId: request.college_id,
      complaintIds: request.complaint_ids,
    });

    // Mark as downloaded
    await adminClient
      .from("data_deletion_requests")
      .update({
        status: "download_ready",
        download_size_bytes: zipBuffer.length,
      })
      .eq("id", request.id);

    return new NextResponse(zipBuffer as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (err: any) {
    console.error("[data-deletion/download]", err);
    return NextResponse.json({ error: err.message || "Export generation failed" }, { status: 500 });
  }
}
