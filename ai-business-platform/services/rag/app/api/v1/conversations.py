import logging
import time
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.analytics.mongo_logger import analytics_logger
from app.llm.providers.factory import get_llm_provider
from app.retrieval.hybrid import hybrid_search
from app.retrieval.prompts import (
    RAG_SYSTEM_PROMPT,
    build_context_and_citations,
    build_rag_user_prompt,
)
from app.storage.conversation_repository import (
    add_message,
    create_conversation,
    get_conversation_messages,
    list_conversations,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class ConversationResponse(BaseModel):
    id: str
    tenant_id: str
    title: Optional[str] = None
    created_at: Any
    updated_at: Any


class CreateConversationRequest(BaseModel):
    tenant_id: str = Field(..., description="Tenant ID")
    title: Optional[str] = None


class MessageResponse(BaseModel):
    id: str
    tenant_id: str
    conversation_id: str
    role: str
    content: str
    metadata: Dict[str, Any] = {}
    created_at: Any


class SendMessageRequest(BaseModel):
    tenant_id: str = Field(..., description="Tenant ID")
    query: str = Field(..., min_length=1)
    collection_id: Optional[str] = None
    top_k: int = 5
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    api_key: Optional[str] = None


class SendMessageResponse(BaseModel):
    user_message: MessageResponse
    assistant_message: MessageResponse


@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    tenant_id: str = Query(..., description="Tenant ID"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List conversation threads for a tenant."""
    try:
        threads = list_conversations(tenant_id=tenant_id, limit=limit, offset=offset)
        return [
            ConversationResponse(
                id=str(t["id"]),
                tenant_id=str(t["tenant_id"]),
                title=t.get("title") or "Conversation",
                created_at=t["created_at"],
                updated_at=t["updated_at"],
            )
            for t in threads
        ]
    except Exception as exc:
        logger.exception(f"Error listing conversations: {exc}")
        raise HTTPException(status_code=500, detail="Failed to list conversations")


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_new_conversation(request: CreateConversationRequest):
    """Create a new conversation session for a tenant."""
    try:
        conv_id = create_conversation(
            tenant_id=request.tenant_id,
            title=request.title or "New Conversation",
        )
        return ConversationResponse(
            id=str(conv_id),
            tenant_id=str(request.tenant_id),
            title=request.title or "New Conversation",
            created_at=time.time(),
            updated_at=time.time(),
        )
    except Exception as exc:
        logger.exception(f"Error creating conversation: {exc}")
        raise HTTPException(status_code=500, detail="Failed to create conversation")


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
def get_messages(
    conversation_id: str,
    tenant_id: str = Query(..., description="Tenant ID"),
):
    """Get message history for a conversation."""
    try:
        msgs = get_conversation_messages(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
        )
        return [
            MessageResponse(
                id=str(m["id"]),
                tenant_id=str(m["tenant_id"]),
                conversation_id=str(m["conversation_id"]),
                role=m["role"],
                content=m["content"],
                metadata=m.get("metadata") or {},
                created_at=m["created_at"],
            )
            for m in msgs
        ]
    except Exception as exc:
        logger.exception(f"Error retrieving messages: {exc}")
        raise HTTPException(status_code=500, detail="Failed to get messages")


@router.post("/conversations/{conversation_id}/messages", response_model=SendMessageResponse)
def post_message(
    conversation_id: str,
    request: SendMessageRequest,
):
    """
    Post a user question, execute real RAG retrieval + LLM synthesis,
    and persist both messages in conversation history.
    """
    t_start = time.perf_counter()

    try:
        # 1. Save user message
        user_msg_id = add_message(
            tenant_id=request.tenant_id,
            conversation_id=conversation_id,
            role="user",
            content=request.query,
        )

        # 2. Execute RAG retrieval
        chunks, latencies = hybrid_search(
            query=request.query,
            tenant_id=request.tenant_id,
            top_k=request.top_k,
            collection_id=request.collection_id,
            rerank=True,
            return_latencies=True,
        )

        formatted_context, raw_sources = build_context_and_citations(chunks)

        # 3. LLM synthesis
        llm = get_llm_provider(
            provider_name=request.llm_provider,
            api_key=request.api_key,
            model=request.llm_model,
        )

        answer = ""
        llm_metadata: dict = {}
        token_usage: dict = {}

        if llm is not None:
            prompt = build_rag_user_prompt(query=request.query, formatted_context=formatted_context)
            t_llm = time.perf_counter()
            llm_response = llm.generate(prompt=prompt, system_prompt=RAG_SYSTEM_PROMPT)
            latencies["llm_ms"] = round((time.perf_counter() - t_llm) * 1000, 2)
            answer = llm_response.content
            token_usage = llm_response.token_usage
            llm_metadata = {
                "provider": llm_response.provider,
                "model": llm_response.model,
                "token_usage": token_usage,
            }
        else:
            latencies["llm_ms"] = 0.0
            if chunks:
                answer = (
                    f"Retrieved {len(chunks)} relevant context chunks from knowledge base. "
                    f"Configure LLM_PROVIDER in settings for full synthesized answer."
                )
            else:
                answer = "No relevant context documents were found for your query."
            llm_metadata = {"provider": "none", "model": "none"}

        total_ms = round((time.perf_counter() - t_start) * 1000, 2)
        latencies["total_ms"] = total_ms

        assistant_meta = {
            "sources": raw_sources,
            "latencies_ms": latencies,
            "llm": llm_metadata,
        }

        # 4. Save assistant message with sources & latencies
        assistant_msg_id = add_message(
            tenant_id=request.tenant_id,
            conversation_id=conversation_id,
            role="assistant",
            content=answer,
            metadata=assistant_meta,
        )

        return SendMessageResponse(
            user_message=MessageResponse(
                id=user_msg_id,
                tenant_id=request.tenant_id,
                conversation_id=conversation_id,
                role="user",
                content=request.query,
                metadata={},
                created_at=time.time(),
            ),
            assistant_message=MessageResponse(
                id=assistant_msg_id,
                tenant_id=request.tenant_id,
                conversation_id=conversation_id,
                role="assistant",
                content=answer,
                metadata=assistant_meta,
                created_at=time.time(),
            ),
        )

    except Exception as exc:
        logger.exception(f"Error handling conversation message: {exc}")
        raise HTTPException(status_code=500, detail="Failed to process conversation message")
