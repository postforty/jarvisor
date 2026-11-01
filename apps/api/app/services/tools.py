from langchain_core.tools import tool
from app.services.rag_service import get_rag_service


@tool
def search_hr_regulations(query: str) -> str:
    """주식회사 코리아바이브의 사내 취업규칙 및 인사규정/복무규정(소정근로시간, 재택근무, 연차휴가, 경조휴가, 경조금 차등 지급표, 건강검진 지원금 등)에 관한 조항 및 세부 수치 정보를 검색합니다."""
    # 싱글톤 RAGService 인스턴스를 통해 포맷팅된 검색 결과 반환
    rag_service = get_rag_service()
    return rag_service.search_formatted(query)
