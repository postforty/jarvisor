import pytest
from pathlib import Path
from langchain_core.embeddings import FakeEmbeddings

from app.services.rag_service import RAGService


@pytest.fixture(scope="module")
def hr_rag_service(tmp_path_factory):
    """실제 hr_regulations.pdf 파일을 로드하고 인덱싱한 RAGService 픽스처"""
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    pdf_path = str(base_dir / "workspace" / "documents" / "hr_regulations.pdf")
    temp_dir = tmp_path_factory.mktemp("eval_faiss")

    service = RAGService(
        pdf_path=pdf_path,
        storage_dir=str(temp_dir),
        embeddings=FakeEmbeddings(size=768),
    )
    service.build_index()
    return service


def test_q1_probation_marriage_congratulatory_clause_retrieval(hr_rag_service):
    """
    Q1: 입사 3개월 차 직원이 본인 결혼을 하게 될 경우 경조금 (126,000원)
    검증: PDF에서 제7조 및 예외조항 제1호(수습 30% 감액) 내용이 정상 인출되는지 검증
    """
    chunks = hr_rag_service.load_and_chunk_documents()
    combined = " ".join([c.page_content for c in chunks])

    # 1. 원본 본인 결혼 기준액(420,000원) 존재 확인
    assert "420,000" in combined
    # 2. 수습 기간 30% 지급 예외 조항 존재 확인
    assert "30%" in combined or "수습" in combined


def test_q2_in_house_marriage_clause_retrieval(hr_rag_service):
    """
    Q2: 사내 결혼 부부 합산 경조금 (2,288,000원)
    검증: PDF에서 제7조 예외조항 제2호(상위 근속자 160% 단일 지급) 내용이 정상 인출되는지 검증
    """
    chunks = hr_rag_service.load_and_chunk_documents()
    combined = " ".join([c.page_content for c in chunks])

    # 1. 2년 이상 본인 결혼 기준액(1,430,000원) 존재 확인
    assert "1,430,000" in combined
    # 2. 사내 커플 160% 단일 지급 규정 존재 확인
    assert "160%" in combined or "사내 커플" in combined or "사내" in combined


def test_q3_health_check_non_partner_hospital_clause_retrieval(hr_rag_service):
    """
    Q3: 비제휴 병원 건강검진 400,000원 발생 시 보전액 (340,000원)
    검증: PDF에서 제8조 제2항(연간 430,000원 한도, 비제휴 85% 보전) 내용이 정상 인출되는지 검증
    """
    chunks = hr_rag_service.load_and_chunk_documents()
    combined = " ".join([c.page_content for c in chunks])

    # 1. 건강검진 지원금 연간 430,000원 한도 존재 확인
    assert "430,000" in combined
    # 2. 비제휴 병원 85% 보전 규정 존재 확인
    assert "85%" in combined
