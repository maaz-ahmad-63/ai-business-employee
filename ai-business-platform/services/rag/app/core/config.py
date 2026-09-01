from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "ai_platform"
    postgres_password: str = "change_this_password"
    postgres_db: str = "ai_platform"
    database_url_override: Optional[str] = None

    # Embeddings
    embedding_model: str = "BAAI/bge-m3"
    embedding_dimension: int = 1024
    embedding_normalize: bool = True
    embedding_device: Optional[str] = None
    embedding_batch_size: int = 32

    # Reranker
    reranker_enabled: bool = True
    reranker_model: str = "BAAI/bge-reranker-base"
    reranker_candidates: int = 20
    reranker_top_k: int = 5
    reranker_device: Optional[str] = None

    # Retrieval & Chunking
    rrf_k: int = 60
    default_top_k: int = 5
    default_candidate_k: int = 20
    chunk_size: int = 500
    chunk_overlap: int = 50

    # MongoDB Analytics (Optional)
    mongodb_url: Optional[str] = None
    mongodb_database: str = "ai_platform"
    mongodb_collection: str = "rag_analytics"

    # LLM Settings (Pluggable)
    llm_provider: Optional[str] = None  # "openai", "anthropic", "gemini", "ollama", "mock"
    llm_model: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_api_base: Optional[str] = None
    llm_temperature: float = 0.1
    llm_max_tokens: int = 1000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return self.database_url_override
        return (
            f"postgresql+psycopg://"
            f"{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}"
            f"/{self.postgres_db}"
        )


settings = Settings()
