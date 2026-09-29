import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: transactionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const adminClient = createAdminClient();

  // Fetch transaction with college and subscription details
  const { data: txn, error } = await adminClient
    .from("payment_transactions")
    .select("*, colleges(id, name, address, contact_email, contact_phone)")
    .eq("id", transactionId)
    .single();

  if (error || !txn) {
    return new NextResponse("Invoice not found", { status: 404 });
  }

  // Ensure requesting user belongs to this college or is super_admin
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, college_id")
    .eq("id", user.id)
    .single();

  if (
    profile?.role !== "super_admin" &&
    profile?.college_id !== txn.college_id
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Generate PDF Invoice via pdf-lib
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pageWidth = 595.28; // A4 standard pt
  const pageHeight = 841.89;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // 1. Header Bar: Brand Name & TAX INVOICE title
  page.drawRectangle({
    x: margin,
    y: y - 55,
    width: contentWidth,
    height: 55,
    color: rgb(0.08, 0.12, 0.22), // Deep navy
  });

  page.drawText("ReportAndFix", {
    x: margin + 16,
    y: y - 30,
    size: 20,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText("CAMPUS OPERATIONS & FACILITY PLATFORM", {
    x: margin + 16,
    y: y - 44,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.65, 0.75, 0.95),
  });

  page.drawText("TAX INVOICE", {
    x: margin + contentWidth - 110,
    y: y - 34,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  y -= 75;

  // 2. Company Details & Invoice Metadata (2 Columns)
  const invoiceNum = txn.invoice_number || `INV-${new Date(txn.created_at).getFullYear()}-${txn.id.slice(0, 8).toUpperCase()}`;
  const invoiceDate = new Date(txn.created_at).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Left: Provider info
  page.drawText("ISSUED BY:", { x: margin, y, size: 8, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
  y -= 13;
  page.drawText("ReportAndFix Cloud Technologies Inc.", { x: margin, y, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  y -= 13;
  page.drawText("GSTIN: 07AAAAA0000A1Z5 (Provisional/Placeholder)", { x: margin, y, size: 8.5, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
  y -= 12;
  page.drawText("SAC Code: 998313 — Information Technology Cloud Services", { x: margin, y, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  y -= 12;
  page.drawText("Email: billing@reportandfix.com | Web: https://reportandfix.com", { x: margin, y, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

  // Right: Invoice numbers
  const rightX = margin + 320;
  let rightY = y + 50;
  page.drawText("INVOICE DETAILS:", { x: rightX, y: rightY, size: 8, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
  rightY -= 13;
  page.drawText(`Invoice No: ${invoiceNum}`, { x: rightX, y: rightY, size: 9.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  rightY -= 13;
  page.drawText(`Invoice Date: ${invoiceDate}`, { x: rightX, y: rightY, size: 8.5, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
  rightY -= 12;
  page.drawText(`Payment Gateway: Razorpay India`, { x: rightX, y: rightY, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  rightY -= 12;
  page.drawText(`Payment Ref: ${txn.razorpay_payment_id || "Direct Verified"}`, { x: rightX, y: rightY, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

  y -= 25;

  // 3. Bill To Box
  page.drawRectangle({
    x: margin,
    y: y - 50,
    width: contentWidth,
    height: 50,
    color: rgb(0.97, 0.98, 1),
    borderColor: rgb(0.85, 0.88, 0.95),
    borderWidth: 1,
  });

  const collegeName = (txn.colleges as any)?.name ?? "Organisation Client";
  const collegeEmail = (txn.colleges as any)?.contact_email ?? "Admin Contact";
  const collegeAddr = (txn.colleges as any)?.address ?? "Registered Campus Address";

  page.drawText("BILLED TO:", { x: margin + 12, y: y - 14, size: 7.5, font: fontBold, color: rgb(0.4, 0.4, 0.5) });
  page.drawText(collegeName, { x: margin + 12, y: y - 27, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(`${collegeEmail} · ${collegeAddr}`, { x: margin + 12, y: y - 41, size: 8, font: fontRegular, color: rgb(0.35, 0.35, 0.4) });

  y -= 70;

  // 4. Itemized Table Header
  const tableY = y;
  page.drawRectangle({
    x: margin,
    y: tableY - 20,
    width: contentWidth,
    height: 20,
    color: rgb(0.92, 0.94, 0.98),
  });

  page.drawText("DESCRIPTION", { x: margin + 10, y: tableY - 14, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("SAC", { x: margin + 270, y: tableY - 14, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("QTY", { x: margin + 330, y: tableY - 14, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("RATE", { x: margin + 390, y: tableY - 14, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("AMOUNT (INR)", { x: margin + contentWidth - 85, y: tableY - 14, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });

  y -= 38;

  // 5. Line Item Row
  const totalAmountPaise = txn.amount_paise || 0;
  const totalAmountRs = totalAmountPaise / 100;
  // Calculate taxable value (assuming inclusive 18% GST)
  const taxableBase = Math.round((totalAmountRs / 1.18) * 100) / 100;
  const gstAmount = Math.round((totalAmountRs - taxableBase) * 100) / 100;
  const itemDesc = txn.description || "ReportAndFix Campus Operations Subscription";

  page.drawText(itemDesc.slice(0, 42), { x: margin + 10, y, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText("998313", { x: margin + 270, y, size: 8.5, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
  page.drawText("1", { x: margin + 335, y, size: 8.5, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`Rs. ${taxableBase.toFixed(2)}`, { x: margin + 380, y, size: 8.5, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`Rs. ${taxableBase.toFixed(2)}`, { x: margin + contentWidth - 80, y, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

  y -= 15;
  page.drawText("Access to QR resolution, staff roster dispatch, B2 retention & two-tier verification", {
    x: margin + 10,
    y,
    size: 7.5,
    font: fontOblique,
    color: rgb(0.45, 0.45, 0.45),
  });

  // Table bottom border
  y -= 15;
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentWidth, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });

  y -= 25;

  // 6. Tax Summary Box
  const summaryX = margin + 270;
  page.drawText("Taxable Subtotal:", { x: summaryX, y, size: 8.5, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`Rs. ${taxableBase.toFixed(2)}`, { x: margin + contentWidth - 80, y, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  y -= 16;

  page.drawText("Integrated GST (IGST 18%):", { x: summaryX, y, size: 8.5, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`Rs. ${gstAmount.toFixed(2)}`, { x: margin + contentWidth - 80, y, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  y -= 18;

  // Grand Total Highlight
  page.drawRectangle({
    x: summaryX - 10,
    y: y - 8,
    width: margin + contentWidth - summaryX + 10,
    height: 24,
    color: rgb(0.92, 0.98, 0.94),
    borderColor: rgb(0.65, 0.88, 0.72),
    borderWidth: 1,
  });

  page.drawText("Total Amount Paid:", { x: summaryX, y, size: 10, font: fontBold, color: rgb(0.08, 0.45, 0.22) });
  page.drawText(`Rs. ${totalAmountRs.toFixed(2)}`, { x: margin + contentWidth - 85, y, size: 10.5, font: fontBold, color: rgb(0.08, 0.45, 0.22) });

  y -= 45;

  // 7. Payment Verification Stamp Box
  page.drawRectangle({
    x: margin,
    y: y - 55,
    width: 200,
    height: 55,
    color: rgb(0.94, 0.99, 0.95),
    borderColor: rgb(0.2, 0.65, 0.3),
    borderWidth: 1.5,
  });

  page.drawText("PAID & VERIFIED", {
    x: margin + 35,
    y: y - 22,
    size: 13,
    font: fontBold,
    color: rgb(0.12, 0.55, 0.25),
  });

  page.drawText(`Method: ${(txn.payment_method || "Online").toUpperCase()} · INR`, {
    x: margin + 30,
    y: y - 36,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.25, 0.55, 0.3),
  });

  page.drawText(`Txn ID: ${txn.id.slice(0, 18)}...`, {
    x: margin + 20,
    y: y - 48,
    size: 7,
    font: fontRegular,
    color: rgb(0.4, 0.55, 0.4),
  });

  // 8. Footer Terms & Note
  const footerY = margin + 35;
  page.drawLine({
    start: { x: margin, y: footerY + 20 },
    end: { x: margin + contentWidth, y: footerY + 20 },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.85),
  });

  page.drawText("Terms & Conditions:", { x: margin, y: footerY + 8, size: 7.5, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(
    "This is a system-generated electronic tax invoice and does not require a physical signature. GST charges applicable per Government of India norms.",
    { x: margin, y: footerY - 3, size: 7, font: fontRegular, color: rgb(0.5, 0.5, 0.5) }
  );
  page.drawText(
    "For billing assistance, quota increases, or dispute resolution, contact support@reportandfix.com.",
    { x: margin, y: footerY - 14, size: 7, font: fontRegular, color: rgb(0.5, 0.5, 0.5) }
  );

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceNum}.pdf"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
