import mammoth from 'mammoth';
import {
  INGESTION_OCR_MIN_TEXT_LENGTH,
  INGESTION_PREVIEW_OCR_MAX_PAGES,
  INGESTION_PREVIEW_PDF_PAGE_COUNT,
  INGESTION_PREVIEW_TEXT_CHAR_LIMIT,
} from '@/lib/ai/ingestion-tuning';

type ExtractionPass = 'preview' | 'remainder' | 'full';

type ExtractionOptions = {
  pass?: ExtractionPass;
};

type PdfTextItem = { str?: string };

type PdfPage = {
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
  getViewport: (opts: { scale: number }) => { height: number; width: number };
  render: (opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { height: number; width: number };
  }) => { promise: Promise<void> };
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
};

type PdfJsModule = {
  version: string;
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> };
};

let pdfjsLibPromise: Promise<PdfJsModule> | null = null;

async function getPdfjsLib() {
  if (typeof window === 'undefined') {
    throw new Error('PDF parsing is only available in the browser.');
  }

  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
      return pdfjs as unknown as PdfJsModule;
    });
  }

  return pdfjsLibPromise!;
}

/**
 * Loads Tesseract.js globally from CDN to bypass the Vercel/Webpack native binding errors
 * commonly experienced when installing it via npm in Next.js.
 */
function loadTesseract(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject("Cannot load Tesseract outside browser");
    if ((window as unknown as { Tesseract?: unknown }).Tesseract) return resolve();

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Tesseract.js"));
    document.head.appendChild(script);
  });
}

/**
 * Extracts text from a generic file (PDF, DOCX, TXT)
 */
export async function extractTextFromFile(
  file: File,
  onProgress: (status: string) => void,
  options: ExtractionOptions = {}
): Promise<string> {
  const pass = options.pass ?? 'full';
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'pdf' || file.type === 'application/pdf') {
    return await extractPdfText(file, onProgress, pass);
  }
  
  if (extension === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return await extractDocxText(file, onProgress, pass);
  }

  // Fallback for .txt or other generic text
  onProgress("Reading text file...");
  const text = await file.text();

  if (pass === 'preview') {
    return text.slice(0, INGESTION_PREVIEW_TEXT_CHAR_LIMIT);
  }

  if (pass === 'remainder') {
    return text.slice(INGESTION_PREVIEW_TEXT_CHAR_LIMIT);
  }

  return text;
}

/**
 * Parses PDF documents. If pages contain no text, runs WebAssembly Tesseract OCR to scan the image.
 */
async function extractPdfText(
  file: File,
  onProgress: (status: string) => void,
  pass: ExtractionPass
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await getPdfjsLib();
  
  onProgress("Loading PDF engine...");
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  const previewEndPage = Math.min(INGESTION_PREVIEW_PDF_PAGE_COUNT, pdf.numPages);
  let startPage = 1;
  let endPage = pdf.numPages;

  if (pass === 'preview') {
    startPage = 1;
    endPage = previewEndPage;
  } else if (pass === 'remainder') {
    startPage = previewEndPage + 1;
    endPage = pdf.numPages;
  }

  if (startPage > endPage) {
    return "";
  }

  let ocrPagesUsed = 0;

  for (let i = startPage; i <= endPage; i++) {
    onProgress(`Reading page ${i} of ${pdf.numPages}...`);
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str ?? '').join(' ');

    if (pageText.trim().length > INGESTION_OCR_MIN_TEXT_LENGTH) {
      // Normal digital PDF text found
      fullText += pageText + "\n\n";
    } else {
      const canUseOcr =
        pass !== 'preview' || ocrPagesUsed < INGESTION_PREVIEW_OCR_MAX_PAGES;

      if (!canUseOcr) {
        continue;
      }

      // Empty page or scanned image. Engage Tesseract OCR
      onProgress(`Page ${i} appears to be a scanned image. Starting OCR engine...`);
      await loadTesseract();
      ocrPagesUsed += 1;

      // Render the PDF page to a canvas to pass to the OCR engine
      const scale = 2.0; // Higher scale = better OCR accuracy but slower
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context!, viewport }).promise;

      // Extract image using Tesseract WebWorker
      const { data: { text } } = await (window as unknown as { Tesseract: { recognize: (c: HTMLCanvasElement, lang: string, opts: { logger: (m: { status: string; progress: number }) => void }) => Promise<{ data: { text: string } }> } }).Tesseract.recognize(
        canvas,
        'eng',
        {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text') {
              onProgress(`Scanning Page ${i}... ${Math.round(m.progress * 100)}% complete`);
            } else {
              onProgress(`OCR initialization: ${m.status}...`);
            }
          }
        }
      );

      fullText += text + "\n\n";
    }
  }

  onProgress("Text extraction complete!");
  return fullText;
}

/**
 * Parses DOCX files using client-side mammoth
 */
async function extractDocxText(
  file: File,
  onProgress: (status: string) => void,
  pass: ExtractionPass
): Promise<string> {
  onProgress("Reading DOCX file...");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  onProgress("Text extraction complete!");

  if (pass === 'preview') {
    return result.value.slice(0, INGESTION_PREVIEW_TEXT_CHAR_LIMIT);
  }

  if (pass === 'remainder') {
    return result.value.slice(INGESTION_PREVIEW_TEXT_CHAR_LIMIT);
  }

  return result.value;
}