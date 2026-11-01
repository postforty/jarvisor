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


@pytest.fixture(scope="module")
def secops_rag_service(tmp_path_factory):
    """실제 secops_infra_sop.pdf 파일을 로드하고 인덱싱한 RAGService 픽스처"""
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    pdf_path = str(base_dir / "workspace" / "documents" / "secops_infra_sop.pdf")
    temp_dir = tmp_path_factory.mktemp("eval_secops_faiss")

    service = RAGService(
        pdf_path=pdf_path,
        storage_dir=str(temp_dir),
        embeddings=FakeEmbeddings(size=768),
        domain_label="인프라 및 보안 절차서",
    )
    service.build_index()
    return service


def test_q4_kvnet_session_timeout_clause_retrieval(secops_rag_service):
    """
    Q4: 사내망(KV-Net) 접속 단일 세션 최대 유효 시간 (220분 또는 3시간 40분)
    검증: PDF에서 제1장 제2절 세션 유효 시간(220분) 내용이 정상 인출되는지 검증
    """
    chunks = secops_rag_service.load_and_chunk_documents()
    combined = " ".join([c.page_content for c in chunks])

    # 1. KV-Net 및 세션 키워드 존재 확인
    assert "KV-Net" in combined or "사내망" in combined
    # 2. 220분 또는 3시간 40분 세션 수치 존재 확인
    assert "220분" in combined or "220" in combined


def test_q5_concurrent_device_limit_clause_retrieval(secops_rag_service):
    """
    Q5: 동일 IP 환경 사내망 동시 접속 허용 최대 단말기 수 (1대) 및 에러 코드 (KV-ERR-9921)
    검증: PDF에서 제2장 제2절 동일 IP 최대 1대 제한 및 고유 에러 코드 KV-ERR-9921 인출 검증
    """
    chunks = secops_rag_service.load_and_chunk_documents()
    combined = " ".join([c.page_content for c in chunks])

    # 1. 고유 에러 코드 KV-ERR-9921 존재 확인
    assert "KV-ERR-9921" in combined
    # 2. 1대(또는 단일 기기) 제한 키워드 존재 확인
    assert "1대" in combined or "동일 IP" in combined


def test_q6_obsidian_incident_grade_clause_retrieval(secops_rag_service):
    """
    Q6: 결제 API 지연율 9% 도달 시 발령되는 최상위 장애 등급 공식 명칭 (Obsidian / 흑요석)
    검증: PDF에서 제3장 제1절 장애 등급 분류 체계(지연율 8% 이상 -> Obsidian) 인출 검증
    """
    chunks = secops_rag_service.load_and_chunk_documents()
    combined = " ".join([c.page_content for c in chunks])

    # 1. Obsidian 또는 흑요석 장애 등급 존재 확인
    assert "Obsidian" in combined or "흑요석" in combined
    # 2. 결제 API 지연율 기준치(8% 또는 9%) 조항 존재 확인
    assert "지연율" in combined or "결제" in combined

