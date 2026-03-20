export const INGESTION_PREVIEW_PDF_PAGE_COUNT = 2;
export const INGESTION_PREVIEW_TEXT_CHAR_LIMIT = 8000;
export const INGESTION_OCR_MIN_TEXT_LENGTH = 20;
export const INGESTION_PREVIEW_OCR_MAX_PAGES = 2;

export const INGESTION_TUNING_DESCRIPTIONS = [
  {
    key: "INGESTION_PREVIEW_PDF_PAGE_COUNT",
    description:
      "How many initial PDF pages to extract in the fast preview pass before background continuation.",
  },
  {
    key: "INGESTION_PREVIEW_TEXT_CHAR_LIMIT",
    description:
      "How many characters to keep for preview extraction for non-paginated documents like DOCX/TXT.",
  },
  {
    key: "INGESTION_OCR_MIN_TEXT_LENGTH",
    description:
      "If extracted text on a PDF page is shorter than this threshold, page is treated as scanned and OCR is used.",
  },
  {
    key: "INGESTION_PREVIEW_OCR_MAX_PAGES",
    description:
      "Maximum number of pages allowed to run OCR during preview mode to keep first response fast.",
  },
] as const;
