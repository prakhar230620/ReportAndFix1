import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user.id)
    .single();

  const { location_ids } = (await req.json()) as { location_ids: string[] };
  if (!Array.isArray(location_ids) || location_ids.length === 0) {
    return NextResponse.json({ error: "location_ids required" }, { status: 400 });
  }

  const [{ data: locations, error }, { data: joinCodeRow }] = await Promise.all([
    supabase
      .from("locations")
      .select("id, name, location_code, qr_token")
      .in("id", location_ids),
    profile?.college_id
      ? supabase
          .from("org_join_codes")
          .select("code")
          .eq("college_id", profile.college_id)
          .eq("is_active", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const activeJoinCode = (joinCodeRow as any)?.code ?? null;

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!locations || locations.length === 0) {
    return NextResponse.json({ error: "No matching locations found" }, { status: 404 });
  }


  const origin = req.nextUrl.origin;
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 30;
  const CELL_W = (PAGE_W - MARGIN * 2) / 2;
  const CELL_H = (PAGE_H - MARGIN * 2) / 2;

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let indexOnPage = 0;

  for (const loc of locations) {
    if (indexOnPage === 4) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      indexOnPage = 0;
    }

    const col = indexOnPage % 2;
    const row = Math.floor(indexOnPage / 2);
    const cellX = MARGIN + col * CELL_W;
    const cellY = PAGE_H - MARGIN - (row + 1) * CELL_H;

    page.drawRectangle({
      x: cellX,
      y: cellY,
      width: CELL_W,
      height: CELL_H,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
    });

    const reportUrl = `${origin}/report/${loc.qr_token}`;
    const qrPngDataUrl = await QRCode.toDataURL(reportUrl, { margin: 1, width: 300 });
    const qrPngBytes = Buffer.from(qrPngDataUrl.split(",")[1], "base64");
    const qrImage = await pdfDoc.embedPng(qrPngBytes);

    // Layout constants for this cell
    const HEADER_H = 22;   // title bar height at top
    const FOOTER_H = activeJoinCode ? 62 : 48;   // extra height when join code is printed
    const qrSize = Math.min(CELL_W, CELL_H) - HEADER_H - FOOTER_H - 20;
    const qrX = cellX + (CELL_W - qrSize) / 2;
    const qrY = cellY + FOOTER_H + 10;

    // Header: "ReportAndFix" brand
    page.drawRectangle({
      x: cellX,
      y: cellY + CELL_H - HEADER_H,
      width: CELL_W,
      height: HEADER_H,
      color: rgb(0.08, 0.08, 0.08),
    });
    page.drawText("ReportAndFix", {
      x: cellX + 10,
      y: cellY + CELL_H - HEADER_H + 6,
      size: 10,
      font,
      color: rgb(1, 1, 1),
    });

    // QR code
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

    // Footer text area
    const { data: fullPath } = await supabase.rpc("location_full_path" as never, {
      p_location_id: loc.id,
    } as never);
    const pathText = (fullPath as unknown as string) ?? loc.name;

    const nameText = loc.name.length > 32 ? loc.name.slice(0, 32) + "…" : loc.name;
    const pathStr = pathText.length > 48 ? pathText.slice(0, 48) + "…" : pathText;

    // Line 1: Location name (bold, larger)
    page.drawText(nameText, {
      x: cellX + 10,
      y: cellY + FOOTER_H - 14,
      size: 11,
      font,
      color: rgb(0, 0, 0),
    });
    // Line 2: Full path (small, grey)
    page.drawText(pathStr, {
      x: cellX + 10,
      y: cellY + FOOTER_H - 28,
      size: 8,
      font: fontRegular,
      color: rgb(0.35, 0.35, 0.35),
    });
    // Line 3: Location code (bottom-right corner, faintest)
    if (loc.location_code) {
      page.drawText(loc.location_code, {
        x: cellX + CELL_W - 60,
        y: cellY + FOOTER_H - 42,
        size: 8,
        font: fontRegular,
        color: rgb(0.55, 0.55, 0.55),
      });
    }
    // Line 4: Join Code (printed prominently below location info)
    if (activeJoinCode) {
      page.drawText("Join Code:", {
        x: cellX + 10,
        y: cellY + FOOTER_H - 54,
        size: 7,
        font: fontRegular,
        color: rgb(0.45, 0.45, 0.45),
      });
      page.drawText(activeJoinCode, {
        x: cellX + 52,
        y: cellY + FOOTER_H - 54,
        size: 9,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
    }

    indexOnPage++;
  }

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="reportandfix-qr-codes.pdf"`,
    },
  });
}
