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
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "college_admin" && profile.role !== "super_admin")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { location_ids } = (await req.json()) as { location_ids: string[] };
  if (!Array.isArray(location_ids) || location_ids.length === 0) {
    return NextResponse.json({ error: "location_ids required" }, { status: 400 });
  }

  const { data: locations, error } = await supabase
    .from("locations")
    .select("id, name, location_code, qr_token, buildings(name), floors(label)")
    .in("id", location_ids);

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

    const qrSize = Math.min(CELL_W, CELL_H) - 90;
    const qrX = cellX + (CELL_W - qrSize) / 2;
    const qrY = cellY + 40;

    page.drawText("ReportAndFix", {
      x: cellX + 12,
      y: cellY + CELL_H - 20,
      size: 12,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });

    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

    const buildingName = (loc as any).buildings?.name ?? "";
    const floorLabel = (loc as any).floors?.label ?? "";

    const nameText = loc.name.length > 30 ? loc.name.slice(0, 30) + "…" : loc.name;
    page.drawText(nameText, {
      x: cellX + 12,
      y: cellY + 26,
      size: 11,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText(
      [buildingName, floorLabel].filter(Boolean).join(" · "),
      { x: cellX + 12, y: cellY + 12, size: 9, font: fontRegular, color: rgb(0.3, 0.3, 0.3) }
    );
    if (loc.location_code) {
      page.drawText(loc.location_code, {
        x: cellX + CELL_W - 70,
        y: cellY + 12,
        size: 9,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5),
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
