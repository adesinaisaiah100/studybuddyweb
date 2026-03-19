import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Initialize PDF.js worker using CDN to strictly avoid Webpack node_modules issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

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
  onProgress: (status: string) => void
): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'pdf' || file.type === 'application/pdf') {
    return await extractPdfText(file, onProgress);
  }
  
  if (extension === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return await extractDocxText(file, onProgress);
  }

  // Fallback for .txt or other generic text
  onProgress("Reading text file...");
  return await file.text();
}

/**
 * Parses PDF documents. If pages contain no text, runs WebAssembly Tesseract OCR to scan the image.
 */
async function extractPdfText(file: File, onProgress: (status: string) => void): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  
  onProgress("Loading PDF engine...");
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress(`Reading page ${i} of ${pdf.numPages}...`);
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // @ts-expect-error - Some items may not have 'str' property in exact type definitions
    const pageText = textContent.items.map((item) => item.str).join(' ');

    if (pageText.trim().length > 20) {
      // Normal digital PDF text found
      fullText += pageText + "\n\n";
    } else {
      // Empty page or scanned image. Engage Tesseract OCR
      onProgress(`Page ${i} appears to be a scanned image. Starting OCR engine...`);
      await loadTesseract();

      // Render the PDF page to a canvas to pass to the OCR engine
      const scale = 2.0; // Higher scale = better OCR accuracy but slower
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // @ts-expect-error - Render parameter typing might differ based on pdf.js version, canvasContext works at runtime
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
async function extractDocxText(file: File, onProgress: (status: string) => void): Promise<string> {
  onProgress("Reading DOCX file...");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  onProgress("Text extraction complete!");
  return result.value;
}