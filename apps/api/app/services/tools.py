from langchain_core.tools import tool
from app.services.rag_service import get_rag_service


@tool
def search_hr_regulations(query: str) -> str:
    """주식회사 코리아바이브의 사내 취업규칙 및 인사규정/복무규정(소정근로시간, 재택근무, 연차휴가, 경조휴가, 경조금 차등 지급표, 건강검진 지원금 등)에 관한 조항 및 세부 수치 정보를 검색합니다."""
    # 싱글톤 인사 규정 RAGService 인스턴스를 통해 포맷팅된 검색 결과 반환
    rag_service = get_rag_service("hr")
    return rag_service.search_formatted(query)


@tool
def search_secops_sop(query: str) -> str:
    """주식회사 코리아바이브의 사내 인프라 및 보안 운영 절차서(SOP), 사내망(KV-Net) 접속 규정, 단일 세션 유효 시간(타임아웃), 동일 IP 동시 접속 단말 수 제한, 보안 에러 코드(KV-ERR-9921 등), 서비스 장애 등급 분류 체계(Obsidian 등)에 관한 조항 및 절차를 검색합니다."""
    # 싱글톤 인프라/보안 RAGService 인스턴스를 통해 포맷팅된 검색 결과 반환
    rag_service = get_rag_service("secops")
    return rag_service.search_formatted(query)


# 사용 가능한 모든 RAG 도구 목록
AVAILABLE_RAG_TOOLS = [search_hr_regulations, search_secops_sop]

