import os
import shutil
import pytest
from pathlib import Path
from langchain_core.embeddings import FakeEmbeddings

from app.services.rag_service import RAGService, get_rag_service
from app.core.config import settings


@pytest.fixture
def test_secops_storage_dir(tmp_path):
    """임시 SecOps FAISS 인덱스 저장소 디렉토리 픽스처"""
    temp_dir = tmp_path / "faiss_secops_test"
    temp_dir.mkdir(parents=True, exist_ok=True)
    yield str(temp_dir)
    if temp_dir.exists():
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_secops_pdf_loading():
    """인프라 및 보안 절차서(secops_infra_sop.pdf) 문서 로드 및 청킹 검증"""
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    pdf_path = str(base_dir / "workspace" / "documents" / "secops_infra_sop.pdf")

    assert os.path.exists(pdf_path), f"테스트 대상 PDF 파일이 존재해야 합니다: {pdf_path}"

    service = RAGService(
        pdf_path=pdf_path,
        embeddings=FakeEmbeddings(size=768),
        domain_label="인프라 및 보안 절차서",
    )
    chunks = service.load_and_chunk_documents()

    assert len(chunks) > 0

    # 모든 청크의 메타데이터 소스가 secops_infra_sop.pdf인지 검증
    for chunk in chunks:
        source = chunk.metadata.get("source", "")
        assert source.lower().endswith("secops_infra_sop.pdf"), f"SecOps PDF 외의 소스가 포함되었습니다: {source}"

    # SecOps 고유 키워드(KV-Net, 세션, 에러 코드 등) 포함 검증
    combined_text = " ".join([c.page_content for c in chunks])
    assert "KV-Net" in combined_text or "사내망" in combined_text or "Obsidian" in combined_text


def test_secops_faiss_build_and_search(test_secops_storage_dir):
    """SecOps PDF 기반 FAISS 인덱스 빌드 및 검색 검증"""
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    pdf_path = str(base_dir / "workspace" / "documents" / "secops_infra_sop.pdf")

    service = RAGService(
        pdf_path=pdf_path,
        storage_dir=test_secops_storage_dir,
        embeddings=FakeEmbeddings(size=768),
        domain_label="인프라 및 보안 절차서",
    )

    # 1. 인덱스 생성 및 저장
    vectorstore = service.build_index()
    assert vectorstore is not None
    assert os.path.exists(os.path.join(test_secops_storage_dir, "index.faiss"))
    assert os.path.exists(os.path.join(test_secops_storage_dir, "index.pkl"))

    # 2. 로컬에서 다시 로드 및 포맷팅 검색 검증
    formatted_result = service.search_formatted("사내망 세션 최대 시간", k=2)
    assert isinstance(formatted_result, str)
    assert "[문서 검색 결과 #" in formatted_result
    assert "secops_infra_sop.pdf" in formatted_result


def test_get_rag_service_domain_factory():
    """도메인별(hr, secops) RAGService 팩토리 인스턴스 분리 검증"""
    hr_service = get_rag_service("hr")
    secops_service = get_rag_service("secops")

    assert hr_service is not secops_service
    assert "hr" in str(hr_service.pdf_path).lower()
    assert "secops" in str(secops_service.pdf_path).lower()
