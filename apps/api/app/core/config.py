from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """자비서 백엔드 API 설정 클래스"""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_NAME: str = "자비서 (jarvisor) API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Gemini LLM 모델 설정
    GEMINI_API_KEY: str = ""
    GEMINI_DEFAULT_MODEL: str = "gemini-3.1-flash-lite"
    GEMINI_FAST_MODEL: str = "gemini-3.5-flash-lite"

    # Cloudflare Workers AI 모델 설정
    CLOUDFLARE_ACCOUNT_ID: str = ""
    CLOUDFLARE_API_TOKEN: str = ""
    CLOUDFLARE_DEFAULT_MODEL: str = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"

    # 데이터베이스 설정
    DATABASE_URL: str = "sqlite:///./jarvisor.db"

    # RAG 문서 및 로컬 FAISS 설정
    PDF_DOCUMENT_PATH: str = "../../workspace/documents/hr_regulations.pdf"
    FAISS_INDEX_DIR: str = "./storage/faiss_hr"
    HR_PDF_PATH: str = "../../workspace/documents/hr_regulations.pdf"
    FAISS_HR_DIR: str = "./storage/faiss_hr"
    SECOPS_PDF_PATH: str = "../../workspace/documents/secops_infra_sop.pdf"
    FAISS_SECOPS_DIR: str = "./storage/faiss_secops"
    EMBEDDING_MODEL: str = "models/gemini-embedding-2"
    EMBEDDING_DIMENSION: int = 768

    # CORS 허용 도메인 목록
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


# 전역 설정 싱글톤 인스턴스
settings = Settings()
