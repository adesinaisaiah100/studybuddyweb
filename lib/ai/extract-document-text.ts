type ExtractDocumentTextInput = {
  buffer: Buffer;
  fileType: string;
};

export type ExtractDocumentTextResult = {
  text: string;
  method: "pdf_cells" | "pdf_ocr" | "docx";
  diagnostics: {
    fileType: string;
    textLength: number;
    totalPages?: number;
    ocrAttempted?: boolean;
    ocrPages?: number;
    ocrModel?: string;
  };
};

function envNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type Pdf2JsonTextItem = {
  x: number;
  y: number;
  R?: Array<{ T?: string }>;
};

type Pdf2JsonPage = {
  Texts?: Pdf2JsonTextItem[];
};

type Pdf2JsonData = {
  formImage?: {
    Pages?: Pdf2JsonPage[];
  };
};

function decodePdf2JsonText(item: Pdf2JsonTextItem): string {
  const parts = (item.R || [])
    .map((r) => r.T || "")
    .filter((t) => t.length > 0)
    .map((t) => {
      try {
        return decodeURIComponent(t);
      } catch {
        return t;
      }
    });
  return parts.join("").trim();
}

async function ocrWithOpenRouter(dataUrls: string[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return "";

  const model =
    process.env.OCR_MODEL ||
    "openrouter/healer-alpha";
  const timeoutMs = envNumber("OCR_TIMEOUT_MS", 25_000);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 2500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "You are OCR for a university timetable. Extract ALL visible text. Prefer a table-like output: use TAB (\\t) between columns and newline between rows. If multiple pages are provided, keep them separate and prefix each page with `--- PAGE N ---`. Do not add commentary. If nothing is readable, return an empty string.",
              },
              ...dataUrls.map((url) => ({
                type: "image_url",
                image_url: { url },
              })),
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) return "";
    const json = (await res.json()) as unknown;
    if (!json || typeof json !== "object") return "";
    const choices = (json as { choices?: unknown }).choices;
    if (!Array.isArray(choices) || choices.length === 0) return "";
    const message = (choices[0] as { message?: unknown }).message;
    if (!message || typeof message !== "object") return "";
    const content = (message as { content?: unknown }).content;
    return typeof content === "string" ? content : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function renderPdfPagesToPngDataUrls(
  buffer: Buffer,
  maxPages: number,
  scale: number
): Promise<string[]> {
  // Render pages using PDF.js directly. We disable workers to avoid Next/Turbopack
  // worker resolution issues in dev.
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as {
    getDocument: (params: {
      data: Uint8Array;
      disableWorker: boolean;
    }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<unknown>; destroy: () => Promise<void> }> };
  };
  const { createCanvas } = await import("@napi-rs/canvas");

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
  });

  const doc = await loadingTask.promise;

  try {
    const pages: string[] = [];
    const total = doc.numPages || 0;
    const count = Math.min(total, Math.max(1, maxPages));

    for (let pageNumber = 1; pageNumber <= count; pageNumber++) {
      const page = (await doc.getPage(pageNumber)) as {
        getViewport: (opts: { scale: number }) => { width: number; height: number };
        render: (opts: {
          canvasContext: unknown;
          viewport: { width: number; height: number };
        }) => { promise: Promise<unknown> };
      };
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height)
      );
      const ctx = canvas.getContext("2d");

      await page.render({ canvasContext: ctx as unknown, viewport }).promise;

      const png = canvas.toBuffer("image/png");
      pages.push(`data:image/png;base64,${png.toString("base64")}`);
    }

    return pages;
  } finally {
    await doc.destroy();
  }
}

async function parsePdfToCellsText(buffer: Buffer): Promise<{
  text: string;
  totalPages?: number;
}> {
  const PDFParser = (await import("pdf2json")).default as unknown as new () => {
    on: (event: string, cb: (data: unknown) => void) => void;
    parseBuffer: (buf: Buffer) => void;
  };

  const pdfData = await new Promise<Pdf2JsonData>((resolve, reject) => {
    const parser = new PDFParser();
    parser.on("pdfParser_dataError", (err: unknown) => reject(err));
    parser.on("pdfParser_dataReady", (data: unknown) =>
      resolve(data as Pdf2JsonData)
    );
    parser.parseBuffer(buffer);
  });

  const pages = pdfData.formImage?.Pages || [];
  const maxPages = Math.max(1, envNumber("PDF_MAX_PAGES", 2));
  const rowThreshold = envNumber("PDF_ROW_THRESHOLD", 0.8);
  const cellGap = envNumber("PDF_CELL_GAP", 2.0);

  const pageOutputs: string[] = [];

  for (let i = 0; i < Math.min(pages.length, maxPages); i++) {
    const page = pages[i];
    const items = (page.Texts || [])
      .map((t) => ({
        x: t.x,
        y: t.y,
        text: decodePdf2JsonText(t),
      }))
      .filter((t) => t.text.length > 0)
      .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

    // Group items into rows by y proximity, then into "cells" by x gaps.
    const rows: Array<Array<{ x: number; text: string }>> = [];
    let currentRow: Array<{ x: number; text: string }> = [];
    let currentY: number | null = null;

    for (const item of items) {
      if (currentY === null || Math.abs(item.y - currentY) <= rowThreshold) {
        currentRow.push({ x: item.x, text: item.text });
        currentY = currentY ?? item.y;
      } else {
        rows.push(currentRow);
        currentRow = [{ x: item.x, text: item.text }];
        currentY = item.y;
      }
    }
    if (currentRow.length > 0) rows.push(currentRow);

    const lines = rows.map((row) => {
      row.sort((a, b) => a.x - b.x);

      const cells: string[] = [];
      let lastX: number | null = null;
      for (const part of row) {
        if (lastX === null || Math.abs(part.x - lastX) > cellGap) {
          cells.push(part.text);
        } else {
          const last = cells[cells.length - 1] || "";
          cells[cells.length - 1] = `${last} ${part.text}`.trim();
        }
        lastX = part.x;
      }

      return cells.join("\t").trim();
    });

    const pageText = lines.filter((l) => l.length > 0).join("\n");
    pageOutputs.push(`--- PAGE ${i + 1} ---\n${pageText}`);
  }

  const text = pageOutputs.join("\n\n").trim();
  return { text, totalPages: pages.length };
}

export async function extractDocumentText(
  input: ExtractDocumentTextInput
): Promise<ExtractDocumentTextResult> {
  const fileType = input.fileType.toLowerCase();

  if (fileType === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: input.buffer });
    const text = result.value || "";
    return {
      text,
      method: "docx",
      diagnostics: { fileType, textLength: text.length },
    };
  }

  if (fileType !== "pdf") {
    return {
      text: "",
      method: "pdf_cells",
      diagnostics: { fileType, textLength: 0 },
    };
  }

  const parsed = await parsePdfToCellsText(input.buffer);
  const minChars = envNumber("PDF_MIN_TEXT_CHARS", 80);

  if (parsed.text.trim().length >= minChars) {
    return {
      text: parsed.text,
      method: "pdf_cells",
      diagnostics: {
        fileType,
        textLength: parsed.text.length,
        totalPages: parsed.totalPages,
      },
    };
  }

  // Fallback for scanned/photographed PDFs: render first pages and OCR them.
  // If OCR isn't configured, return what we have without doing extra work.
  if (!process.env.OPENROUTER_API_KEY) {
    return {
      text: parsed.text,
      method: "pdf_cells",
      diagnostics: {
        fileType,
        textLength: parsed.text.length,
        totalPages: parsed.totalPages,
        ocrAttempted: false,
      },
    };
  }

  const ocrMaxPages = Math.max(1, envNumber("OCR_MAX_PAGES", 2));
  const ocrScale = Math.max(1, envNumber("OCR_SCALE", 1.6));
  const images = await renderPdfPagesToPngDataUrls(
    input.buffer,
    ocrMaxPages,
    ocrScale
  );
  const ocrText = images.length > 0 ? await ocrWithOpenRouter(images) : "";
  const merged = `${parsed.text}\n\n${ocrText}`.trim();

  return {
    text: merged,
    method: ocrText.trim().length > 0 ? "pdf_ocr" : "pdf_cells",
    diagnostics: {
      fileType,
      textLength: merged.length,
      totalPages: parsed.totalPages,
      ocrAttempted: true,
      ocrPages: images.length,
      ocrModel:
        process.env.OCR_MODEL ||
        "google/gemini-2.0-flash-lite:preview-02-05:free",
    },
  };
}
