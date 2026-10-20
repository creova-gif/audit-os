import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  db,
  engagementsTable,
  clientsTable,
  workingPapersTable,
  findingsTable,
  anomaliesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Compiles an engagement's working papers, findings, and sign-offs into a standardized PDF binder.
 */
export async function compileAuditBinder(engagementId: number): Promise<Uint8Array> {
  const [engagement] = await db
    .select()
    .from(engagementsTable)
    .where(eq(engagementsTable.id, engagementId));

  if (!engagement) {
    throw new Error(`Engagement #${engagementId} not found`);
  }

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, engagement.clientId));

  const papers = await db
    .select()
    .from(workingPapersTable)
    .where(eq(workingPapersTable.engagementId, engagementId));

  const findings = await db
    .select()
    .from(findingsTable)
    .where(eq(findingsTable.engagementId, engagementId));

  const anomalies = await db
    .select()
    .from(anomaliesTable)
    .where(eq(anomaliesTable.engagementId, engagementId));

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);

  // --- PAGE 1: COVER & ENGAGEMENT SUMMARY ---
  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  // Header banner
  page.drawRectangle({
    x: 40,
    y: height - 100,
    width: width - 80,
    height: 60,
    color: rgb(0.1, 0.2, 0.4),
  });

  page.drawText("AUDIT OS — FORMAL AUDIT BINDER", {
    x: 55,
    y: height - 70,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText("In Accordance with ISA 230 / AICPA AU-C 230 Documentation Standards", {
    x: 55,
    y: height - 88,
    size: 10,
    font: fontRegular,
    color: rgb(0.85, 0.9, 1),
  });

  let y = height - 140;

  const drawField = (label: string, value: string) => {
    page.drawText(label, { x: 50, y, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(value, { x: 180, y, size: 10, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
    y -= 20;
  };

  drawField("Client:", client?.name || "Client Name");
  drawField("Engagement Name:", engagement.engagementName);
  drawField("Audit Period:", `${engagement.periodStart} to ${engagement.periodEnd}`);
  drawField("Engagement Type:", engagement.engagementType.toUpperCase());
  drawField("Overall Risk Rating:", engagement.overallRisk.toUpperCase());
  drawField("Planning Materiality:", engagement.materialityUsd ? `$${engagement.materialityUsd.toLocaleString()}` : "N/A");
  drawField("Performance Materiality:", engagement.performanceMatUsd ? `$${engagement.performanceMatUsd.toLocaleString()}` : "N/A");
  drawField("Report / Sign-off Date:", engagement.signedOffAt || engagement.reportDate || "In Progress");

  y -= 15;
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 25;

  // Table of Contents
  page.drawText("MASTER WORKING PAPER INDEX", { x: 50, y, size: 12, font: fontBold, color: rgb(0.1, 0.2, 0.4) });
  y -= 20;

  if (papers.length === 0) {
    page.drawText("No working papers recorded for this engagement.", { x: 50, y, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
  } else {
    for (const wp of papers) {
      const statusLabel = wp.status === "signed_off" ? "[SIGNED OFF]" : `[${wp.status.toUpperCase()}]`;
      page.drawText(`${wp.wpRef.padEnd(8)} ${wp.title}`, { x: 50, y, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(statusLabel, { x: width - 150, y, size: 9, font: fontCourier, color: wp.status === "signed_off" ? rgb(0.1, 0.5, 0.2) : rgb(0.5, 0.3, 0.1) });
      y -= 18;
      if (y < 80) break;
    }
  }

  // --- SUBSEQUENT PAGES: WORKING PAPERS DETAIL ---
  for (const wp of papers) {
    page = pdfDoc.addPage([595.28, 841.89]);
    y = height - 60;

    // WP Header
    page.drawText(`WORKING PAPER: ${wp.wpRef} — ${wp.title}`, {
      x: 50,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.1, 0.2, 0.4),
    });
    y -= 16;

    page.drawText(`Section: ${wp.section} | Status: ${wp.status.toUpperCase()}`, {
      x: 50,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 12;

    if (wp.signedOffHash) {
      page.drawText(`SHA-256 Sign-Off Hash: ${wp.signedOffHash.slice(0, 32)}...`, {
        x: 50,
        y,
        size: 8,
        font: fontCourier,
        color: rgb(0.2, 0.5, 0.2),
      });
      y -= 12;
    }

    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 25;

    // Body content (truncated lines to fit cleanly)
    const content = wp.contentText || "No narrative content recorded for this working paper.";
    const lines = content.split("\n");

    for (const line of lines) {
      if (y < 60) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - 60;
      }

      const truncated = line.length > 90 ? line.slice(0, 90) + "..." : line;
      const isHeader = line.startsWith("#");

      page.drawText(truncated, {
        x: 50,
        y,
        size: isHeader ? 11 : 9,
        font: isHeader ? fontBold : fontRegular,
        color: isHeader ? rgb(0.1, 0.2, 0.4) : rgb(0.2, 0.2, 0.2),
      });

      y -= isHeader ? 18 : 13;
    }
  }

  // --- FINAL PAGE: FINDINGS & ANOMALIES SCHEDULE ---
  page = pdfDoc.addPage([595.28, 841.89]);
  y = height - 60;

  page.drawText("SCHEDULE OF AUDIT FINDINGS & FLAGGED ANOMALIES", {
    x: 50,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.2, 0.4),
  });
  y -= 20;

  page.drawText(`Total Findings: ${findings.length} | Flagged Ledger Anomalies: ${anomalies.length}`, {
    x: 50,
    y,
    size: 10,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 15;

  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 20;

  for (const f of findings.slice(0, 10)) {
    if (y < 60) break;
    page.drawText(`[FINDING] ${f.title}`, { x: 50, y, size: 10, font: fontBold, color: rgb(0.8, 0.2, 0.1) });
    y -= 14;
    page.drawText(`Ref: ${f.findingRef} | Status: ${f.status.toUpperCase()} | Risk: ${f.riskLevel.toUpperCase()}`, {
      x: 50,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 18;
  }

  return await pdfDoc.save();
}
