from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from docling.document_converter import DocumentConverter
import tempfile
import os
import uvicorn

app = FastAPI(title="StudyBuddy Docling Parser", version="1.0.0")

# Allow CORS from your Next.js app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {".pdf", ".docx"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/parse")
async def parse_document(file: UploadFile = File(...)):
    """
    Accepts a PDF or DOCX file and returns the extracted text using Docling.
    """
    # Validate file extension
    _, ext = os.path.splitext(file.filename or "")
    ext = ext.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Save uploaded file to a temp location
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Use Docling to convert the document
        converter = DocumentConverter()
        result = converter.convert(tmp_path)

        # Export as markdown text (preserves table structure well)
        extracted_text = result.document.export_to_markdown()

        return {
            "success": True,
            "filename": file.filename,
            "file_type": ext.replace(".", ""),
            "extracted_text": extracted_text,
            "character_count": len(extracted_text),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse document: {str(e)}",
        )

    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
