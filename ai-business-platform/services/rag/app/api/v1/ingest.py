import json
import logging
import time
from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.ingestion.service import ingestion_service
from app.schemas.rag import IngestResponse, IngestTextRequest

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/ingest", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
def ingest_text_document(request: IngestTextRequest):
    """
    Ingest a plain text document, split into chunks, embed via BGE-M3,
    and persist in PostgreSQL/pgvector.
    """
    t_start = time.perf_counter()

    try:
        res = ingestion_service.ingest_text(
            tenant_id=request.tenant_id,
            text_content=request.text,
            filename=request.filename,
            source=request.source,
            collection_id=request.collection_id,
            metadata=request.metadata,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
        )

        took_ms = round((time.perf_counter() - t_start) * 1000, 2)

        return IngestResponse(
            document_id=res["document_id"],
            filename=res["filename"],
            chunk_count=res["chunk_count"],
            status=res["status"],
            took_ms=took_ms,
        )

    except Exception as exc:
        logger.exception(f"Document ingestion failed for tenant {request.tenant_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest document: {str(exc)}",
        )


@router.post("/ingest/file", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest_file_document(
    file: UploadFile = File(...),
    tenant_id: str = Form(...),
    collection_id: Optional[str] = Form(None),
    source: Optional[str] = Form(None),
    metadata: Optional[str] = Form(None),
    chunk_size: Optional[int] = Form(None),
    chunk_overlap: Optional[int] = Form(None),
):
    """
    Upload and ingest a document file (TXT, PDF, DOCX).
    Extracts text, preserves page numbers, chunks, embeds, and stores in PostgreSQL.
    """
    t_start = time.perf_counter()

    try:
        content = await file.read()
        parsed_metadata = None
        if metadata:
            try:
                parsed_metadata = json.loads(metadata)
            except Exception:
                parsed_metadata = {"raw_metadata": metadata}

        res = ingestion_service.ingest_bytes(
            tenant_id=tenant_id,
            data=content,
            filename=file.filename or "uploaded_file",
            mime_type=file.content_type,
            source=source,
            collection_id=collection_id,
            metadata=parsed_metadata,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

        took_ms = round((time.perf_counter() - t_start) * 1000, 2)

        return IngestResponse(
            document_id=res["document_id"],
            filename=res["filename"],
            chunk_count=res["chunk_count"],
            status=res["status"],
            took_ms=took_ms,
        )

    except Exception as exc:
        logger.exception(f"File ingestion failed for tenant {tenant_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest file: {str(exc)}",
        )
