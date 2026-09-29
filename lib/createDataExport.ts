import "server-only";
import JSZip from "jszip";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFromB2, uploadToB2, getB2SignedUrl } from "@/lib/b2";

export type ExportResult = {
  zipBuffer: Buffer;
  pdfBuffer: Buffer;
  filename: string;
  totalComplaints: number;
  totalMediaFiles: number;
};

/**
 * Generates a multi-column PDF report listing all complaint IDs, titles, and completion dates.
 */
export async function generateDeletionManifestPdf(
  orgName: string,
  complaints: Array<{
    public_id: string;
    title: string;
    category?: string;
    completed_at?: string | null;
  }>
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  const pageWidth = 595.28; // A4 standard pt
  const pageHeight = 841.89;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Header
  page.drawText("ReportAndFix — Data Deletion Manifest", {
    x: margin,
    y: y - 10,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 25;

  page.drawText(`Organisation: ${orgName}`, {
    x: margin,
    y: y,
    size: 10,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawText(`Date: ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })} | Total Records: ${complaints.length}`, {
    x: margin + 250,
    y: y,
    size: 9,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 15;

  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentWidth, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 15;

  // Multi-column list (2 columns of complaints per page for high density yet readability)
  const colWidth = (contentWidth - 20) / 2;
  const rowHeight = 28;
  const maxRowsPerPage = Math.floor((pageHeight - margin * 2 - 80) / rowHeight);

  let currentItemIndex = 0;

  while (currentItemIndex < complaints.length) {
    if (y < margin + 40) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;

      // Repeat compact header on subsequent pages
      page.drawText(`ReportAndFix Manifest — ${orgName} (Continued)`, {
        x: margin,
        y: y,
        size: 9,
        font: fontBold,
        color: rgb(0.4, 0.4, 0.4),
      });
      y -= 20;
    }

    const colIndex = (currentItemIndex % 2);
    const colX = margin + colIndex * (colWidth + 20);
    const c = complaints[currentItemIndex];

    const completedStr = c.completed_at
      ? new Date(c.completed_at).toLocaleDateString("en-IN")
      : "Completed";

    // Public ID badge
    page.drawText(`#${c.public_id}`, {
      x: colX,
      y: y,
      size: 9,
      font: fontBold,
      color: rgb(0.1, 0.3, 0.7),
    });

    page.drawText(completedStr, {
      x: colX + colWidth - 60,
      y: y,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });

    const truncatedTitle = c.title.length > 36 ? c.title.substring(0, 34) + "..." : c.title;
    page.drawText(truncatedTitle, {
      x: colX,
      y: y - 10,
      size: 8,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
    });

    if (c.category) {
      page.drawText(c.category, {
        x: colX,
        y: y - 19,
        size: 7,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.4),
      });
    }

    currentItemIndex++;

    // When both columns in the row are filled, move down
    if (colIndex === 1 || currentItemIndex === complaints.length) {
      y -= rowHeight;
    }
  }

  // Footer on last page
  page.drawText("This data was permanently deleted per organisation request. ReportAndFix platform.", {
    x: margin,
    y: margin,
    size: 7,
    font: fontRegular,
    color: rgb(0.6, 0.6, 0.6),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Builds a comprehensive ZIP package with JSON records, manifest PDF, and Backblaze media attachments.
 */
export async function createDataExportArchive({
  collegeId,
  complaintIds,
}: {
  collegeId: string;
  complaintIds: string[];
}): Promise<ExportResult> {
  const adminClient = createAdminClient();

  // Fetch college name
  const { data: college } = await adminClient
    .from("colleges")
    .select("name")
    .eq("id", collegeId)
    .single();

  const orgName = college?.name ?? "Organisation";

  // Fetch complete complaint records with categories and locations
  const { data: complaints, error } = await adminClient
    .from("complaints")
    .select(`
      id,
      public_id,
      title,
      description,
      status,
      created_at,
      completed_at,
      location_id,
      category_id,
      image_urls,
      worker_notes,
      assigned_worker_id,
      categories (name),
      locations (name, code)
    `)
    .eq("college_id", collegeId)
    .in("id", complaintIds);

  if (error || !complaints) {
    throw new Error(`Failed to retrieve complaints: ${error?.message || "Not found"}`);
  }

  // Create ZIP
  const zip = new JSZip();

  // 1. JSON records manifest
  const exportData = {
    organisation: orgName,
    exported_at: new Date().toISOString(),
    total_complaints: complaints.length,
    complaints: complaints.map((c) => ({
      id: c.id,
      public_id: c.public_id,
      title: c.title,
      description: c.description,
      category: (c.categories as any)?.name ?? null,
      location: (c.locations as any)?.name ?? null,
      location_code: (c.locations as any)?.code ?? null,
      status: c.status,
      created_at: c.created_at,
      completed_at: c.completed_at,
      worker_notes: c.worker_notes,
      media_files: c.image_urls ?? [],
    })),
  };

  zip.file("complaints_data.json", JSON.stringify(exportData, null, 2));

  // 2. Generate PDF Manifest
  const manifestComplaints = complaints.map((c) => ({
    public_id: c.public_id,
    title: c.title,
    category: (c.categories as any)?.name,
    completed_at: c.completed_at,
  }));

  const pdfBuffer = await generateDeletionManifestPdf(orgName, manifestComplaints);
  zip.file("data_deletion_manifest.pdf", pdfBuffer);

  // 3. Fetch media files from B2 and bundle into zip under `media/` folder
  const mediaFolder = zip.folder("media");
  let totalMediaFiles = 0;

  for (const c of complaints) {
    const urls = c.image_urls || [];
    for (const rawUrl of urls) {
      if (!rawUrl) continue;

      let key = rawUrl;
      // Strip any query params or domain prefix if present
      if (rawUrl.includes("?path=")) {
        key = decodeURIComponent(rawUrl.split("?path=")[1]);
      } else if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
        try {
          const parsed = new URL(rawUrl);
          key = parsed.pathname.replace(/^\//, "");
        } catch {
          // Use rawUrl as key
        }
      }

      try {
        const fileObj = await getFromB2(key);
        if (fileObj?.buffer && mediaFolder) {
          const safeName = key.replace(/[\/\\]/g, "_");
          mediaFolder.file(safeName, fileObj.buffer);
          totalMediaFiles++;
        }
      } catch (mediaErr) {
        console.warn(`[data-export] Failed to include media ${key}:`, mediaErr);
      }
    }
  }

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${orgName.replace(/[^a-zA-Z0-9_-]/g, "_")}_data_export_${timestamp}.zip`;

  return {
    zipBuffer,
    pdfBuffer,
    filename,
    totalComplaints: complaints.length,
    totalMediaFiles,
  };
}
