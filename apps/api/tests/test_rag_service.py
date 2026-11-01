import os
import shutil
import pytest
from pathlib import Path
from langchain_core.embeddings import FakeEmbeddings

from app.services.rag_service import RAGService
from app.core.config import settings


@pytest.fixture
def test_storage_dir(tmp_path):
    """임시 FAISS 인덱스 저장소 디렉토리 픽스처"""
    temp_dir = tmp_path / "faiss_test"
    temp_dir.mkdir(parents=True, exist_ok=True)
    yield str(temp_dir)
    if temp_dir.exists():
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_rag_service_pdf_only_loading():
    """오직 hr_regulations.pdf 단일 PDF 문서만 로드되는지 검증 (타 확장자 배제)"""
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    pdf_path = str(base_dir / "workspace" / "documents" / "hr_regulations.pdf")

    assert os.path.exists(pdf_path), f"테스트 대상 PDF 파일이 존재해야 합니다: {pdf_path}"

    service = RAGService(pdf_path=pdf_path, embeddings=FakeEmbeddings(size=768))
    chunks = service.load_and_chunk_documents()

    assert len(chunks) > 0

    # 모든 청크의 메타데이터 소스가 hr_regulations.pdf인지 검증
    for chunk in chunks:
        source = chunk.metadata.get("source", "")
        assert source.lower().endswith("hr_regulations.pdf"), f"PDF 외의 소스가 포함되었습니다: {source}"

    # PDF 내의 주요 인사규정 키워드(경조금, 취업규칙 등) 포함 검증
    combined_text = " ".join([c.page_content for c in chunks])
    assert "경조금" in combined_text or "취업규칙" in combined_text


def test_rag_service_default_model_config():
    """기본 임베딩 모델 설정이 gemini-embedding-2인지 검증"""
    assert "gemini-embedding-2" in settings.EMBEDDING_MODEL
    assert settings.EMBEDDING_DIMENSION == 768


def test_build_and_search_faiss_index(test_storage_dir):
    """FakeEmbeddings(size=768) 기반 FAISS 인덱스 빌드, 로컬 저장 및 검색 검증"""
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    pdf_path = str(base_dir / "workspace" / "documents" / "hr_regulations.pdf")

    service = RAGService(
        pdf_path=pdf_path,
        storage_dir=test_storage_dir,
        embeddings=FakeEmbeddings(size=768),
    )

    # 1. 인덱스 생성 및 저장
    vectorstore = service.build_index()
    assert vectorstore is not None
    assert os.path.exists(os.path.join(test_storage_dir, "index.faiss"))
    assert os.path.exists(os.path.join(test_storage_dir, "index.pkl"))

    # 2. 로컬에서 다시 로드 및 검색 검증
    results = service.search("본인 결혼 경조금", k=2)
    assert len(results) > 0
    assert hasattr(results[0], "page_content")


def test_search_hr_documents_formatted(test_storage_dir):
    """검색 결과가 LLM 프롬프트에 주입하기 적합한 문자열로 포맷팅되는지 검증"""
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    pdf_path = str(base_dir / "workspace" / "documents" / "hr_regulations.pdf")

    service = RAGService(
        pdf_path=pdf_path,
        storage_dir=test_storage_dir,
        embeddings=FakeEmbeddings(size=768),
    )
    service.build_index()

    formatted_text = service.search_formatted("수습 기간 경조금", k=2)
    assert isinstance(formatted_text, str)
    assert "[문서 검색 결과 #" in formatted_text
    assert "hr_regulations.pdf" in formatted_text
