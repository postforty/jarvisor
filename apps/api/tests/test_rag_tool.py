import pytest
from unittest.mock import patch, MagicMock

from app.services.tools import search_hr_regulations, search_secops_sop


def test_rag_tool_metadata():
    """RAG 도구의 메타데이터(이름, 설명) 유효성 검증"""
    assert search_hr_regulations.name == "search_hr_regulations"
    doc = search_hr_regulations.description
    assert "취업규칙" in doc or "인사규정" in doc or "복무규정" in doc
    assert "경조금" in doc or "근로시간" in doc


def test_rag_tool_execution():
    """RAG 도구 호출 시 RAGService 검색 결과가 정상 반환되는지 검증"""
    mock_service = MagicMock()
    mock_service.search_formatted.return_value = "[문서 검색 결과 #1] 본인 결혼 420,000원"

    with patch("app.services.tools.get_rag_service", return_value=mock_service):
        result = search_hr_regulations.invoke({"query": "본인 결혼 경조금"})
        assert "420,000원" in result
        mock_service.search_formatted.assert_called_once_with("본인 결혼 경조금")


def test_secops_rag_tool_metadata():
    """SecOps RAG 도구의 메타데이터(이름, 설명) 유효성 검증"""
    assert search_secops_sop.name == "search_secops_sop"
    doc = search_secops_sop.description
    assert "KV-Net" in doc or "사내망" in doc or "인프라" in doc or "보안" in doc
    assert "세션" in doc or "에러 코드" in doc or "장애 등급" in doc or "Obsidian" in doc


def test_secops_rag_tool_execution():
    """SecOps RAG 도구 호출 시 secops RAGService 검색 결과가 정상 반환되는지 검증"""
    mock_service = MagicMock()
    mock_service.search_formatted.return_value = "[문서 검색 결과 #1] KV-Net 단일 세션 220분"

    with patch("app.services.tools.get_rag_service", return_value=mock_service) as mock_get_rag:
        result = search_secops_sop.invoke({"query": "KV-Net 단일 세션 최대 시간"})
        assert "220분" in result
        mock_get_rag.assert_called_once_with("secops")
        mock_service.search_formatted.assert_called_once_with("KV-Net 단일 세션 최대 시간")

