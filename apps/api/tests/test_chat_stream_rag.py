import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from langchain_core.messages import AIMessage, AIMessageChunk

from app.schemas.chat import ModelType, PersonaType
from app.services.llm_service import stream_chat_response


@pytest.mark.asyncio
async def test_stream_chat_response_with_rag_tool():
    """Gemini 모델에서 RAG 도구 호출이 발생했을 때 정상적으로 도구를 실행하고 최종 답변을 스트리밍하는지 검증"""
    mock_tool_call_response = AIMessage(
        content="",
        tool_calls=[
            {
                "name": "search_hr_regulations",
                "args": {"query": "본인 결혼 경조금"},
                "id": "call_test_01",
            }
        ],
    )

    async def mock_final_stream(*args, **kwargs):
        yield AIMessageChunk(content="보스, ")
        yield AIMessageChunk(content="본인 결혼 경조금은 420,000원입니다.")

    mock_model = MagicMock()
    mock_bound_model = MagicMock()
    mock_bound_model.ainvoke = AsyncMock(return_value=mock_tool_call_response)
    mock_model.bind_tools.return_value = mock_bound_model
    mock_model.astream = mock_final_stream

    mock_tool = MagicMock()
    mock_tool.name = "search_hr_regulations"
    mock_tool.invoke.return_value = "[문서 검색 결과] 420,000원"

    with patch("app.services.llm_service.get_chat_model", return_value=mock_model), \
         patch("app.services.llm_service.search_hr_regulations", mock_tool):

        chunks = []
        async for chunk in stream_chat_response(
            message="본인 결혼 경조금 얼마야?",
            model_type=ModelType.DEFAULT.value,
            persona=PersonaType.CLASSIC.value,
        ):
            chunks.append(chunk)

        full_response = "".join(chunks)
        assert "보스" in full_response
        assert "420,000원" in full_response


@pytest.mark.asyncio
async def test_stream_chat_response_cloudflare_llama_context_injection():
    """Cloudflare Llama 3.3 모델 사전 컨텍스트 주입(Pre-retrieval) RAG 검증"""
    captured_messages = []

    async def mock_cf_stream(messages, *args, **kwargs):
        nonlocal captured_messages
        captured_messages = messages
        yield AIMessageChunk(content="보스, 클라우드플레어 Llama 3.3 브리핑입니다. 경조금은 126,000원입니다.")

    mock_model = MagicMock()
    mock_model.astream = mock_cf_stream

    mock_rag_service = MagicMock()
    mock_rag_service.search_formatted.return_value = "[사내 인사 규정: 수습 30% 감액 -> 126,000원]"

    with patch("app.services.llm_service.get_chat_model", return_value=mock_model), \
         patch("app.services.llm_service.get_rag_service", return_value=mock_rag_service):

        chunks = []
        async for chunk in stream_chat_response(
            message="본인 결혼 경조금 얼마야?",
            model_type=ModelType.CF_LLAMA_3_3.value,
            persona=PersonaType.CLASSIC.value,
        ):
            chunks.append(chunk)

        full_response = "".join(chunks)
        assert "Llama 3.3 브리핑" in full_response
        assert "126,000원" in full_response

        # 전달된 메시지 중 사내 규정 인출 조항이 시스템 프롬프트에 주입되었는지 검증
        all_text = " ".join([m.content for m in captured_messages if isinstance(m.content, str)])
        assert "수습 30% 감액" in all_text


@pytest.mark.asyncio
async def test_stream_chat_response_deepseek_r1_context_injection():
    """도구 호출을 지원하지 않는 DeepSeek R1 모델 요청 시 사전 컨텍스트 주입(Pre-retrieval) RAG 검증"""
    captured_messages = []

    async def mock_r1_stream(messages, *args, **kwargs):
        nonlocal captured_messages
        captured_messages = messages
        yield AIMessageChunk(content="DeepSeek R1 추론 결과: 경조금은 126,000원입니다.")

    mock_model = MagicMock()
    mock_model.astream = mock_r1_stream

    mock_rag_service = MagicMock()
    mock_rag_service.search_formatted.return_value = "[사내 규정 인출 조항: 수습 30% 감액 -> 126,000원]"

    with patch("app.services.llm_service.get_chat_model", return_value=mock_model), \
         patch("app.services.llm_service.get_rag_service", return_value=mock_rag_service):

        chunks = []
        async for chunk in stream_chat_response(
            message="입사 3개월 차 결혼 경조금 얼마인가요?",
            model_type=ModelType.CF_DEEPSEEK_R1.value,
            persona=PersonaType.CLASSIC.value,
        ):
            chunks.append(chunk)

        full_response = "".join(chunks)
        assert "126,000원" in full_response

        # 전달된 메시지 중 사내 규정 인출 조항이 시스템 또는 컨텍스트에 주입되었는지 검증
        all_text = " ".join([m.content for m in captured_messages if isinstance(m.content, str)])
        assert "수습 30% 감액" in all_text


@pytest.mark.asyncio
async def test_stream_chat_response_no_tool_call():
    """일반 대화 시 도구 호출 없이 즉시 응답을 스트리밍하는지 검증"""
    mock_normal_response = AIMessage(
        content="안녕하십니까, 보스. 무엇을 도와드릴까요?",
        tool_calls=[],
    )

    mock_model = MagicMock()
    mock_bound_model = MagicMock()
    mock_bound_model.ainvoke = AsyncMock(return_value=mock_normal_response)
    mock_model.bind_tools.return_value = mock_bound_model

    with patch("app.services.llm_service.get_chat_model", return_value=mock_model):
        chunks = []
        async for chunk in stream_chat_response(
            message="안녕",
            model_type=ModelType.DEFAULT.value,
            persona=PersonaType.CLASSIC.value,
        ):
            chunks.append(chunk)

        full_response = "".join(chunks)
        assert "안녕하십니까, 보스" in full_response


@pytest.mark.asyncio
async def test_stream_chat_response_with_secops_rag_tool():
    """Gemini 모델에서 SecOps RAG 도구(search_secops_sop) 호출이 발생했을 때 정상 실행 및 스트리밍 검증"""
    mock_tool_call_response = AIMessage(
        content="",
        tool_calls=[
            {
                "name": "search_secops_sop",
                "args": {"query": "사내망 세션 최대 시간"},
                "id": "call_secops_01",
            }
        ],
    )

    async def mock_final_stream(*args, **kwargs):
        yield AIMessageChunk(content="보스, ")
        yield AIMessageChunk(content="사내망(KV-Net) 단일 세션 최대 유효 시간은 220분입니다.")

    mock_model = MagicMock()
    mock_bound_model = MagicMock()
    mock_bound_model.ainvoke = AsyncMock(return_value=mock_tool_call_response)
    mock_model.bind_tools.return_value = mock_bound_model
    mock_model.astream = mock_final_stream

    mock_tool = MagicMock()
    mock_tool.name = "search_secops_sop"
    mock_tool.invoke.return_value = "[문서 검색 결과] KV-Net 단일 세션 220분"

    with patch("app.services.llm_service.get_chat_model", return_value=mock_model), \
         patch("app.services.llm_service.search_secops_sop", mock_tool):

        chunks = []
        async for chunk in stream_chat_response(
            message="사내망 세션 시간 얼마인가요?",
            model_type=ModelType.DEFAULT.value,
            persona=PersonaType.CLASSIC.value,
        ):
            chunks.append(chunk)

        full_response = "".join(chunks)
        assert "220분" in full_response


@pytest.mark.asyncio
async def test_stream_chat_response_cloudflare_llama_secops_routing():
    """Cloudflare Llama 3.3 모델에서 SecOps 키워드 질의 시 secops RAG 컨텍스트 라우팅 검증"""
    captured_messages = []

    async def mock_cf_stream(messages, *args, **kwargs):
        nonlocal captured_messages
        captured_messages = messages
        yield AIMessageChunk(content="보스, 사내망 단일 세션 시간은 220분입니다.")

    mock_model = MagicMock()
    mock_model.astream = mock_cf_stream

    mock_secops_service = MagicMock()
    mock_secops_service.search_formatted.return_value = "[인프라 보안 절차서: KV-Net 단일 세션 220분]"

    with patch("app.services.llm_service.get_chat_model", return_value=mock_model), \
         patch("app.services.llm_service.get_rag_service", return_value=mock_secops_service) as mock_get_rag:

        chunks = []
        async for chunk in stream_chat_response(
            message="사내망(KV-Net) 세션 유지 시간 알려줘",
            model_type=ModelType.CF_LLAMA_3_3.value,
            persona=PersonaType.CLASSIC.value,
        ):
            chunks.append(chunk)

        full_response = "".join(chunks)
        assert "220분" in full_response

        # get_rag_service("secops")로 라우팅되었는지 검증
        mock_get_rag.assert_called_with("secops")
        all_text = " ".join([m.content for m in captured_messages if isinstance(m.content, str)])
        assert "KV-Net 단일 세션 220분" in all_text

