/** Generation de PDF (pdf-lib) pour les rapports de session. */
import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { SessionReportData } from "@/server/reports";

/** Remplace les caracteres non supportes par la police WinAnsi. */
function toWinAnsi(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u20AC/g, "EUR")
    .replace(/\u0153/g, "oe")
    .replace(/\u0152/g, "OE")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split("\n")) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word.length > 80 ? `${word.slice(0, 78)}…` : word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

class ReportPdf {
  private doc!: PDFDocument;
  private page!: PDFPage;
  private regular!: PDFFont;
  private bold!: PDFFont;
  private y = 0;
  private readonly margin = 48;
  private readonly width = 595.28;
  private readonly height = 841.89;

  async build(data: SessionReportData): Promise<Uint8Array> {
    this.doc = await PDFDocument.create();
    this.regular = await this.doc.embedFont(StandardFonts.Helvetica);
    this.bold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.doc.setTitle(`Rapport de session DEV-${String(data.number).padStart(4, "0")}`);
    this.doc.setAuthor("FiveM DevManager");
    this.doc.setCreator("FiveM DevManager");
    this.newPage();

    this.heading(`SESSION DE DEVELOPPEMENT #DEV-${String(data.number).padStart(4, "0")}`);
    this.paragraph("Rapport genere automatiquement a partir des evenements enregistres.", {
      size: 9,
      color: rgb(0.45, 0.5, 0.6),
    });
    this.spacer(8);

    this.keyValue("Developpeur", data.developer.name);
    this.keyValue("Date", new Date(data.startedAt).toLocaleDateString("fr-FR"));
    this.keyValue(
      "Periode",
      `${new Date(data.startedAt).toLocaleTimeString("fr-FR")} - ${new Date(data.endedAt).toLocaleTimeString("fr-FR")}`,
    );
    this.keyValue("Duree totale", formatDuration(data.durationSeconds));
    this.keyValue("Temps actif estime", formatDuration(data.activeSeconds));
    this.keyValue("Statut", data.status === "COMPLETED" ? "Session terminee" : "Session en cours");
    this.spacer(12);

    this.section("TRAVAIL EFFECTUE", data.tasks.map((task) => `${task.code} - ${task.title} (${task.status})`));
    this.section(
      "FICHIERS MODIFIES",
      [...data.filesCreated, ...data.filesModified].map((file) => file),
    );
    if (data.filesDeleted.length > 0) {
      this.section("FICHIERS SUPPRIMES", data.filesDeleted);
    }
    this.section(
      "BUGS CORRIGES",
      data.bugsFixed.map((bug) => `${bug.code} - ${bug.title}`),
    );
    this.section(
      "TACHES TERMINEES",
      data.tasksCompleted.map((task) => `${task.code} - ${task.title}`),
    );
    this.section(
      "TACHES RESTANTES",
      data.tasksRemaining.map((task) => `${task.code} - ${task.title} (${task.status})`),
    );
    if (data.tests.length > 0) {
      this.section("TESTS EFFECTUES", data.tests.map((test) => `${test.name} : ${test.result}`));
    }
    if (data.notes.length > 0) {
      this.section("NOTES DU DEVELOPPEUR", data.notes);
    }

    this.spacer(10);
    this.paragraph(`Modifications en attente de validation : ${data.pendingChanges}`, { size: 9 });
    if (data.summary) {
      this.spacer(6);
      this.paragraph(`Resume : ${data.summary}`, { size: 9 });
    }

    return this.doc.save();
  }

  private newPage(): void {
    this.page = this.doc.addPage([this.width, this.height]);
    this.y = this.height - this.margin;
  }

  private ensureSpace(height: number): void {
    if (this.y - height < this.margin) this.newPage();
  }

  private heading(text: string): void {
    this.ensureSpace(34);
    this.page.drawText(toWinAnsi(text), {
      x: this.margin,
      y: this.y,
      size: 17,
      font: this.bold,
      color: rgb(0.09, 0.11, 0.16),
    });
    this.y -= 26;
    this.page.drawLine({
      start: { x: this.margin, y: this.y },
      end: { x: this.width - this.margin, y: this.y },
      thickness: 1,
      color: rgb(0.85, 0.87, 0.92),
    });
    this.y -= 10;
  }

  private section(title: string, items: string[]): void {
    this.ensureSpace(40);
    this.spacer(8);
    this.page.drawText(toWinAnsi(title), {
      x: this.margin,
      y: this.y,
      size: 11,
      font: this.bold,
      color: rgb(0.2, 0.24, 0.33),
    });
    this.y -= 16;
    if (items.length === 0) {
      this.paragraph("Aucun element enregistre.", { size: 9, color: rgb(0.45, 0.5, 0.58) });
      return;
    }
    for (const item of items) {
      for (const line of wrap(toWinAnsi(item), this.regular, 9.5, this.width - this.margin * 2 - 12)) {
        this.ensureSpace(14);
        this.page.drawText(`- ${line}`.replace("- -", "-"), {
          x: this.margin + 4,
          y: this.y,
          size: 9.5,
          font: this.regular,
          color: rgb(0.13, 0.16, 0.22),
        });
        this.y -= 13;
      }
    }
  }

  private keyValue(key: string, value: string): void {
    this.ensureSpace(16);
    this.page.drawText(toWinAnsi(`${key} :`), {
      x: this.margin,
      y: this.y,
      size: 9.5,
      font: this.bold,
      color: rgb(0.2, 0.24, 0.33),
    });
    this.page.drawText(toWinAnsi(value), {
      x: this.margin + 130,
      y: this.y,
      size: 9.5,
      font: this.regular,
      color: rgb(0.13, 0.16, 0.22),
    });
    this.y -= 14;
  }

  private paragraph(
    text: string,
    options: { size?: number; color?: ReturnType<typeof rgb> } = {},
  ): void {
    const size = options.size ?? 10;
    for (const line of wrap(toWinAnsi(text), this.regular, size, this.width - this.margin * 2)) {
      this.ensureSpace(size + 4);
      this.page.drawText(line, {
        x: this.margin,
        y: this.y,
        size,
        font: this.regular,
        color: options.color ?? rgb(0.13, 0.16, 0.22),
      });
      this.y -= size + 4;
    }
  }

  private spacer(value: number): void {
    this.y -= value;
  }
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}h${String(m).padStart(2, "0")}`;
}

export async function buildReportPdf(data: SessionReportData): Promise<Uint8Array> {
  return new ReportPdf().build(data);
}
