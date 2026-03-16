# Docling Parser Microservice

A lightweight FastAPI service that extracts text from PDF and DOCX files using [Docling](https://github.com/DS4SD/docling).

## Run Locally

```bash
cd docling-service
pip install -r requirements.txt
python main.py
```

Server starts at `http://localhost:8000`.

## Deploy to Railway

1. Create a new Railway project
2. Connect this directory (`docling-service/`) or push it as a separate repo
3. Railway will detect the `Dockerfile` and build automatically
4. Copy the deployed URL and set it as `DOCLING_SERVICE_URL` in your `.env.local`

## API

### `POST /parse`
Upload a PDF or DOCX file to extract text.

```bash
curl -X POST http://localhost:8000/parse \
  -F "file=@timetable.pdf"
```

**Response:**
```json
{
  "success": true,
  "filename": "timetable.pdf",
  "file_type": "pdf",
  "extracted_text": "...",
  "character_count": 1234
}
```

### `GET /health`
Health check endpoint.
