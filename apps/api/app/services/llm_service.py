import asyncio
from typing import AsyncGenerator
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_cloudflare.chat_models import ChatCloudflareWorkersAI

from app.core.config import settings
from app.schemas.chat import ModelType, PersonaType
from app.services.rag_service import get_rag_service
from app.services.tools import search_hr_regulations, search_secops_sop

# 사용 가능한 모든 RAG 도구 레지스트리
AVAILABLE_TOOLS = [search_hr_regulations, search_secops_sop]
TOOLS_BY_NAME = {t.name: t for t in AVAILABLE_TOOLS}


def detect_query_domain(message: str) -> str:
    """사용자 질의 키워드를 기반으로 적합한 RAG 도메인(secops 또는 hr) 판별"""
    secops_keywords = [
        "사내망", "kv-net", "kvnet", "세션", "타임아웃", "단말", "동일 ip",
        "에러 코드", "kv-err", "obsidian", "흑요석", "장애 등급", "지연율",
        "sop", "인프라", "보안"
    ]
    lowered = message.lower()
    for kw in secops_keywords:
        if kw in lowered:
            return "secops"
    return "hr"

# 페르소나별 시스템 프롬프트 정의
SYSTEM_PROMPTS = {
    PersonaType.CLASSIC: (
        "당신은 영화 '아이언맨'의 인공지능 비서 JARVIS(자비스)를 모티브로 한 최첨단 지능형 개인 비서 '자비서(jarvisor)'입니다. "
        "사용자를 항상 '보스'라고 부르며, 기품 있고 정중하며 논리적이고 절제된 영국식 신사 어조로 답변하십시오. "
        "답변은 반드시 정중한 한국어로 작성하십시오."
    ),
    PersonaType.BRIEF: (
        "당신은 핵심만 신속하게 전달하는 인공지능 비서 '자비서'입니다. "
        "군더더기 없는 개조식과 핵심 단문 위주로 즉시 실행 가능한 정보를 전달하십시오. "
        "불필요한 서두와 맺음말을 생략하고 신속하게 브리핑하십시오."
    ),
    PersonaType.TACTICAL: (
        "당신은 마크 85 수트 전술 분석 및 시스템 모니터링 전담 인공지능 '자비서'입니다. "
        "위협 수준, 자원 소모율, 텔레메트리 수치와 우선순위를 중심으로 단호하고 정확한 전술적 어조로 보고하십시오."
    ),
}


# 모델 식별자 별칭 정규화 매핑 (엔드포인트 단축형 및 규격 별칭 정규화)
MODEL_ALIASES = {
    # Cloudflare 엔드포인트 별칭을 실존 고속 fp8 엔드포인트로 정규화
    "@cf/meta/llama-3.3-70b-instruct": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
}

# 모델별 역량(Capability) 메타데이터 레지스트리
# 향후 신규 모델 추가 시 여기에 선언만 추가하면 RAG 파이프라인이 자동 결정됩니다.
MODEL_CAPABILITIES = {
    # Google Gemini 모델 (Tool Calling 네이티브 지원)
    ModelType.DEFAULT.value: {"supports_tools": True},
    ModelType.FAST.value: {"supports_tools": True},
    ModelType.LEGACY_FLASH.value: {"supports_tools": True},
    # Cloudflare 계열 모델 (오픈소스/추론 특화 -> 안정적인 Pre-retrieval 컨텍스트 주입 방식 적용)
    ModelType.CF_LLAMA_3_3.value: {"supports_tools": False},
    ModelType.CF_LLAMA_3_3_ALIAS.value: {"supports_tools": False},
    ModelType.CF_LLAMA_3_1_8B.value: {"supports_tools": False},
    ModelType.CF_DEEPSEEK_R1.value: {"supports_tools": False},
}


def get_chat_model(model_name: str) -> BaseChatModel:
    """LangChain 표준 BaseChatModel 인스턴스 반환 팩토리 함수"""
    # 별칭이 존재하는 경우 정규화된 모델명으로 치환
    normalized_model_name = MODEL_ALIASES.get(model_name, model_name)

    if normalized_model_name.startswith("@cf/"):
        # Cloudflare Workers AI 모델 생성
        account_id = (settings.CLOUDFLARE_ACCOUNT_ID or "").strip()
        api_token = (settings.CLOUDFLARE_API_TOKEN or "").strip()

        # 인증 정보 미설정 시 사전 검증 안내 예외 발생
        if not account_id or not api_token or account_id == "DUMMY_ACCOUNT_ID":
            raise ValueError(
                "Cloudflare 인증 정보(CLOUDFLARE_ACCOUNT_ID 또는 CLOUDFLARE_API_TOKEN)가 "
                ".env에 설정되지 않았거나 백엔드 서버에 반영되지 않았습니다. "
                ".env 확인 후 백엔드 API 서버를 재시작해 주십시오."
            )

        return ChatCloudflareWorkersAI(
            model=normalized_model_name,
            account_id=account_id,
            api_token=api_token,
        )
    else:
        # Google Gemini 모델 생성 (langchain-google-genai 기반)
        api_key = (settings.GEMINI_API_KEY or "").strip()
        return ChatGoogleGenerativeAI(
            model=normalized_model_name,
            google_api_key=api_key or "DUMMY_KEY",
            temperature=0.7,
        )


async def stream_chat_response(
    message: str,
    model_type: str = ModelType.DEFAULT.value,
    persona: str = PersonaType.CLASSIC.value,
) -> AsyncGenerator[str, None]:
    """모든 모델(Gemini, Llama, DeepSeek 및 향후 추가 모델)에 동일하게 RAG를 적용하는 통합 스트리밍 제너레이터"""
    system_instruction = SYSTEM_PROMPTS.get(
        persona, SYSTEM_PROMPTS[PersonaType.CLASSIC]
    )

    try:
        model = get_chat_model(model_type)
        normalized_model_name = MODEL_ALIASES.get(model_type, model_type)

        # 모델 역량 조회 (기본값: Tool calling 지원으로 간주)
        capability = MODEL_CAPABILITIES.get(
            normalized_model_name,
            MODEL_CAPABILITIES.get(model_type, {"supports_tools": True}),
        )
        supports_tools = capability.get("supports_tools", True)

        # -------------------------------------------------------------
        # 전략 1: 도구 호출 미지원 모델 (DeepSeek R1, 추론 모델, 경량 SLM 등)
        # -> 사전 RAG 검색 후 시스템 컨텍스트에 주입 (Pre-retrieval Context Injection)
        # -------------------------------------------------------------
        if not supports_tools:
            # 질문 분석을 통한 도메인(secops / hr) 라우팅
            domain = detect_query_domain(message)
            rag_service = get_rag_service(domain)
            rag_context = rag_service.search_formatted(message, k=3)

            domain_label = "인프라 및 보안 절차서" if domain == "secops" else "사내 인사 규정"
            augmented_system_prompt = (
                f"{system_instruction}\n\n"
                f"[{domain_label} 참고 자료 (반드시 아래 조항의 문구와 수치를 절대적인 근거로 삼아 답변하십시오)]\n"
                f"{rag_context}\n\n"
                f"규정 및 절차서에 명시된 조항 번호와 예외 규칙, 감액 및 합산 기준을 명확히 제시하십시오."
            )

            messages = [
                SystemMessage(content=augmented_system_prompt),
                HumanMessage(content=message),
            ]

            async for chunk in model.astream(messages):
                content = chunk.content
                if content:
                    if isinstance(content, str):
                        yield content
                    elif isinstance(content, list):
                        for part in content:
                            if isinstance(part, dict) and "text" in part:
                                yield part["text"]
                            elif isinstance(part, str):
                                yield part
                    else:
                        yield str(content)
            return

        # -------------------------------------------------------------
        # 전략 2: 도구 호출 지원 모델 (Gemini, Llama 3.3/3.1 등)
        # -> Agentic Tool Calling (필요 시 RAG 도구 자율 호출)
        # -------------------------------------------------------------
        messages = [
            SystemMessage(content=system_instruction),
            HumanMessage(content=message),
        ]

        # 인사 규정 및 SecOps 절차서 도구를 복수로 바인딩
        model_with_tools = model.bind_tools(AVAILABLE_TOOLS)
        initial_response = await model_with_tools.ainvoke(messages)

        # 도구 호출이 발생한 경우: 도구 실행 후 최종 스트리밍
        if initial_response.tool_calls:
            tool_messages = []
            for tool_call in initial_response.tool_calls:
                call_name = tool_call.get("name")
                tool_instance = TOOLS_BY_NAME.get(call_name)
                if tool_instance:
                    tool_result = tool_instance.invoke(tool_call.get("args", {}))
                    tool_messages.append(
                        ToolMessage(
                            content=str(tool_result),
                            tool_call_id=tool_call.get("id", f"call_{call_name}"),
                        )
                    )

            # 도구 결과 메시지를 포함하여 최종 어시스턴트 답변 스트리밍
            extended_messages = messages + [initial_response] + tool_messages
            async for chunk in model.astream(extended_messages):
                content = chunk.content
                if content:
                    if isinstance(content, str):
                        yield content
                    elif isinstance(content, list):
                        for part in content:
                            if isinstance(part, dict) and "text" in part:
                                yield part["text"]
                            elif isinstance(part, str):
                                yield part
                    else:
                        yield str(content)
            return

        # 도구 호출이 없는 일반 질의의 경우 바로 응답 반환
        if initial_response.content:
            if isinstance(initial_response.content, str):
                yield initial_response.content
            elif isinstance(initial_response.content, list):
                for part in initial_response.content:
                    if isinstance(part, dict) and "text" in part:
                        yield part["text"]
                    elif isinstance(part, str):
                        yield part
            else:
                yield str(initial_response.content)
            return

        # 기본 폴백 스트리밍
        async for chunk in model.astream(messages):
            if chunk.content:
                if isinstance(chunk.content, str):
                    yield chunk.content
                elif isinstance(chunk.content, list):
                    for part in chunk.content:
                        if isinstance(part, dict) and "text" in part:
                            yield part["text"]
                        elif isinstance(part, str):
                            yield part
                else:
                    yield str(chunk.content)

    except Exception as e:
        # 상위 SSE 라우터로 예외를 전달하여 통일된 에러 이벤트로 처리
        raise RuntimeError(f"모델({model_type}) 스트리밍 통신 실패: {str(e)}") from e
