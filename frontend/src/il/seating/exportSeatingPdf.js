import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { countGuestSeats } from "./ilSeatingUtils.js";

function drawHeader(doc, title, pageWidth) {
  doc.setFillColor(44, 44, 44);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(title, pageWidth / 2, 18, { align: "center" });
  doc.setTextColor(40, 40, 40);
}

function drawFooter(doc, pageNumber, pageCount, pageWidth, pageHeight) {
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`momoEVENT · עמוד ${pageNumber} מתוך ${pageCount}`, pageWidth / 2, pageHeight - 10, {
    align: "center"
  });
}

/**
 * Multi-page seating PDF:
 * 1) Visual canvas capture
 * 2+) Assigned guests table (name, count, category/group, table)
 */
export async function exportSeatingPdf({
  canvasElement,
  guests,
  tables,
  eventTitle = "תוכנית הושבה"
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Page 1 — canvas visual
  drawHeader(doc, `${eventTitle} · מפת אולם`, pageWidth);

  if (canvasElement) {
    const canvas = await html2canvas(canvasElement, {
      backgroundColor: "#fcfaf8",
      scale: 2,
      useCORS: true
    });
    const imgData = canvas.toDataURL("image/png");
    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - 48;
    const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
    const drawW = canvas.width * ratio;
    const drawH = canvas.height * ratio;
    const x = (pageWidth - drawW) / 2;
    const y = 36;
    doc.addImage(imgData, "PNG", x, y, drawW, drawH);
  } else {
    doc.setFontSize(12);
    doc.text("לא ניתן לצלם את מפת האולם", pageWidth / 2, pageHeight / 2, { align: "center" });
  }

  // Guest report pages
  const tableMap = new Map(tables.map((table) => [table.tableId, table]));
  const assigned = guests
    .filter((guest) => guest.isEligible && guest.isSeated)
    .sort((a, b) => {
      const labelA = tableMap.get(a.seatingTableId)?.label || "";
      const labelB = tableMap.get(b.seatingTableId)?.label || "";
      const byTable = String(labelA).localeCompare(String(labelB), "he", { numeric: true });
      if (byTable !== 0) return byTable;
      return String(a.fullName || "").localeCompare(String(b.fullName || ""), "he");
    })
    .map((guest) => ({
      name: guest.fullName || "",
      count: countGuestSeats(guest),
      category: guest.guestGroup || guest.guestSide || "—",
      table: tableMap.get(guest.seatingTableId)?.label || "—"
    }));

  const colWidths = [70, 25, 55, 40];
  const headers = ["שם מלא", "כמות", "קטגוריה", "שולחן"];
  const rowHeight = 9;
  const startY = 40;
  const usableHeight = pageHeight - startY - 18;
  const rowsPerPage = Math.max(1, Math.floor(usableHeight / rowHeight));
  const chunks = [];
  for (let i = 0; i < assigned.length; i += rowsPerPage) {
    chunks.push(assigned.slice(i, i + rowsPerPage));
  }
  if (!chunks.length) chunks.push([]);

  chunks.forEach((chunk) => {
    doc.addPage();
    drawHeader(doc, `${eventTitle} · רשימת משובצים`, pageWidth);

    let y = startY;
    const tableStartX = (pageWidth - colWidths.reduce((a, b) => a + b, 0)) / 2;

    // Header row
    doc.setFillColor(232, 223, 216);
    doc.rect(tableStartX, y - 6, colWidths.reduce((a, b) => a + b, 0), rowHeight, "F");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    let x = tableStartX;
    headers.forEach((header, index) => {
      doc.text(header, x + colWidths[index] / 2, y, { align: "center" });
      x += colWidths[index];
    });
    y += rowHeight;

    if (!chunk.length) {
      doc.setFontSize(11);
      doc.text("אין אורחים משובצים עדיין", pageWidth / 2, y + 12, { align: "center" });
      return;
    }

    chunk.forEach((row, rowIndex) => {
      if (rowIndex % 2 === 0) {
        doc.setFillColor(250, 248, 246);
        doc.rect(tableStartX, y - 6, colWidths.reduce((a, b) => a + b, 0), rowHeight, "F");
      }
      const values = [row.name, String(row.count), row.category, String(row.table)];
      let cellX = tableStartX;
      values.forEach((value, index) => {
        const align = index === 0 ? "right" : "center";
        const textX = index === 0 ? cellX + colWidths[index] - 3 : cellX + colWidths[index] / 2;
        doc.text(String(value).slice(0, 42), textX, y, { align });
        cellX += colWidths[index];
      });
      y += rowHeight;
    });
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    drawFooter(doc, page, pageCount, pageWidth, pageHeight);
  }

  doc.save("seating-plan.pdf");
}
