"""Embedding service for generating vector embeddings."""

import hashlib
from openai import OpenAI

from ..config import settings


def _get_embedding_client() -> OpenAI:
    """Get OpenAI client configured for embedding API."""
    api_key = settings.EMBEDDING_API_KEY.strip() or settings.OPENAI_API_KEY.strip()
    base_url = settings.EMBEDDING_BASE_URL.strip() or settings.OPENAI_BASE_URL.strip()

    if not api_key:
        raise ValueError("Embedding API key not configured")

    return OpenAI(api_key=api_key, base_url=base_url)


def _hash_content(content: str) -> str:
    """Generate SHA-256 hash of content for change detection."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def create_embedding(text: str) -> list[float]:
    """Generate embedding vector for a single text.

    Args:
        text: The text to embed.

    Returns:
        List of floats representing the embedding vector.

    Raises:
        ValueError: If API key not configured.
        Exception: If embedding API fails.
    """
    if not settings.EMBEDDING_ENABLED:
        raise ValueError("Embedding is disabled")

    client = _get_embedding_client()
    response = client.embeddings.create(
        model=settings.EMBEDDING_MODEL,
        input=text,
        dimensions=settings.EMBEDDING_DIMENSION,
    )
    return response.data[0].embedding


def create_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Generate embedding vectors for multiple texts.

    Args:
        texts: List of texts to embed.

    Returns:
        List of embedding vectors.

    Raises:
        ValueError: If API key not configured or texts empty.
        Exception: If embedding API fails.
    """
    if not settings.EMBEDDING_ENABLED:
        raise ValueError("Embedding is disabled")

    if not texts:
        return []

    client = _get_embedding_client()
    response = client.embeddings.create(
        model=settings.EMBEDDING_MODEL,
        input=texts,
        dimensions=settings.EMBEDDING_DIMENSION,
    )
    return [item.embedding for item in response.data]


def get_content_hash(content: str) -> str:
    """Get hash of content for embedding change detection."""
    return _hash_content(content)