import { NextRequest, NextResponse } from "next/server";
import { approveDeletionRequest } from "../actions";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const requestId = formData.get("requestId") as string;

    if (!requestId) {
      return NextResponse.redirect(new URL("/admin/data-deletion?error=Missing+request+id", req.url));
    }

    const result = await approveDeletionRequest(requestId);
    if (result.error) {
      return NextResponse.redirect(new URL(`/admin/data-deletion?error=${encodeURIComponent(result.error)}`, req.url));
    }

    return NextResponse.redirect(new URL("/admin/data-deletion?success=Approved", req.url));
  } catch (err: any) {
    return NextResponse.redirect(new URL(`/admin/data-deletion?error=${encodeURIComponent(err.message)}`, req.url));
  }
}
