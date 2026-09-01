import logging
import uuid
from typing import Any, Dict, List, Optional, Union

from app.chunking.chunker import TextChunker
from app.embeddings.bge_m3 import embedding_service
from app.embeddings.embedder import BaseEmbeddingService
from app.ingestion.parser import DocumentParser, ParsedDocument
from app.storage.chunk_repository import insert_chunks_batch
from app.storage.database import SessionLocal
from app.storage.document_repository import create_document, update_document_status

logger = logging.getLogger(__name__)


class IngestionService:
    """End-to-end multi-tenant document ingestion pipeline."""

    def __init__(
        self,
        embedder: Optional[BaseEmbeddingService] = None,
        chunker: Optional[TextChunker] = None,
    ):
        self.embedder = embedder or embedding_service
        self.chunker = chunker or TextChunker()

    def ingest_bytes(
        self,
        tenant_id: str,
        data: bytes,
        filename: str,
        mime_type: Optional[str] = None,
        source: Optional[str] = None,
        collection_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Ingest raw document bytes with atomic database transaction."""
        parsed: ParsedDocument = DocumentParser.parse_bytes(
            data=data,
            filename=filename,
            mime_type=mime_type,
            custom_metadata=metadata,
        )

        doc_metadata = dict(parsed.metadata)
        if metadata:
            doc_metadata.update(metadata)

        db = SessionLocal()
        document_id = None

        try:
            # 1. Create document record
            document_id = create_document(
                tenant_id=tenant_id,
                filename=filename,
                source=source or filename,
                mime_type=parsed.mime_type,
                file_size=parsed.file_size,
                collection_id=collection_id,
                metadata=doc_metadata,
                status="processing",
                db=db,
            )

            # 2. Chunk each section preserving section metadata (e.g. page number)
            chunker = (
                TextChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
                if (chunk_size is not None or chunk_overlap is not None)
                else self.chunker
            )

            all_chunks: List[Dict[str, Any]] = []
            global_chunk_idx = 0

            for section in parsed.sections:
                sec_chunks = chunker.chunk_text(
                    section.text,
                    base_metadata={
                        "filename": filename,
                        "source": source or filename,
                        **section.metadata,
                        **(metadata or {}),
                    },
                )
                for sc in sec_chunks:
                    all_chunks.append({
                        "id": str(uuid.uuid4()),
                        "document_id": document_id,
                        "chunk_index": global_chunk_idx,
                        "content": sc["content"],
                        "metadata": sc["metadata"],
                    })
                    global_chunk_idx += 1

            if not all_chunks:
                # If document is empty, still complete it
                update_document_status(
                    tenant_id=tenant_id,
                    document_id=document_id,
                    status="completed",
                    metadata={"chunk_count": 0},
                    db=db,
                )
                db.commit()
                return {
                    "document_id": document_id,
                    "filename": filename,
                    "chunk_count": 0,
                    "status": "completed",
                }

            # 3. Generate embeddings in batch
            contents = [c["content"] for c in all_chunks]
            embeddings = self.embedder.embed_many(contents)

            for c, emb in zip(all_chunks, embeddings):
                c["embedding"] = emb

            # 4. Insert all chunks into PostgreSQL
            insert_chunks_batch(tenant_id=tenant_id, chunks=all_chunks, db=db)

            # 5. Mark document completed
            update_document_status(
                tenant_id=tenant_id,
                document_id=document_id,
                status="completed",
                metadata={"chunk_count": len(all_chunks)},
                db=db,
            )

            db.commit()
            logger.info(f"Successfully ingested {filename} ({len(all_chunks)} chunks) for tenant {tenant_id}")

            return {
                "document_id": document_id,
                "filename": filename,
                "chunk_count": len(all_chunks),
                "status": "completed",
            }

        except Exception as exc:
            db.rollback()
            logger.exception(f"Failed to ingest document {filename}: {exc}")
            if document_id:
                try:
                    update_document_status(
                        tenant_id=tenant_id,
                        document_id=document_id,
                        status="failed",
                        metadata={"error": str(exc)},
                    )
                except Exception:
                    pass
            raise
        finally:
            db.close()

    def ingest_text(
        self,
        tenant_id: str,
        text_content: str,
        filename: str = "document.txt",
        source: Optional[str] = None,
        collection_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Ingest raw text directly."""
        data = text_content.encode("utf-8")
        return self.ingest_bytes(
            tenant_id=tenant_id,
            data=data,
            filename=filename,
            mime_type="text/plain",
            source=source,
            collection_id=collection_id,
            metadata=metadata,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )


ingestion_service = IngestionService()
