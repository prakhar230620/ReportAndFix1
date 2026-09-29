import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Rate limit tracking (simple in-memory for serverless; use Redis for production)
const attempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const key = `join-validate:${ip}`;

  // 5 attempts per IP per 15 minutes
  if (!checkRateLimit(key, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }

  const { code, collegeId } = await req.json();
  if (!code || !collegeId) {
    return NextResponse.json({ error: "Code and organisation are required." }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("org_join_codes")
    .select("id, college_id")
    .eq("code", code.toUpperCase().trim())
    .eq("college_id", collegeId)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Invalid join code. Please check and try again." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
