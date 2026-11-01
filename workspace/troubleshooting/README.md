# 트러블슈팅 아카이브 (Troubleshooting Archive)

인간 개발자와 AI 에이전트 간의 페어 프로그래밍 중 발생한 실제 문제 상황과 개발자의 프롬프트 오케스트레이션 및 해결 과정을 기록한 아카이브입니다.

> [!NOTE]
> 작성 원칙 및 세부 템플릿 규칙은 [AGENTS.md](./AGENTS.md)를 준수합니다.

---

## 트러블슈팅 목록

| 번호 | 문서 | 핵심 문제 | 프롬프트 오케스트레이션 요약 |
| :--- | :--- | :--- | :--- |
| 01 | [01-uv-trampoline-canonicalize-error.md](./01-uv-trampoline-canonicalize-error.md) | Windows uv trampoline 경로 정규화 실패 | `npm run dev:api` 실행 에러 로그를 제공하여 모듈 직접 로드 방식(`python -m`)으로 스크립트 수정 유도 |
| 02 | [02-material-symbols-font-class-missing.md](./02-material-symbols-font-class-missing.md) | Next.js 16/Tailwind v4 환경 Material Symbols 아이콘 미표시 | 캡처 이미지로 원인 분석 유도 후, 지속 증상에 대해 빌드 번들러의 `@import` 탈락 원인을 역추적하여 `<head>` 직결 `<link>` 방식으로 최종 해결 유도 |
| 03 | [03-header-new-session-button-unresponsive.md](./03-header-new-session-button-unresponsive.md) | 상단 헤더 `+ NEW SESSION` 버튼 미동작 및 세션 초기화 핸들러 누락 | 캡처 이미지로 문제 버튼 지목 후, 상위 페이지의 상태 끌어올리기(State Lifting) 및 이벤트 바인딩으로 세션 리셋 연동 유도 |
| 04 | [04-llm-latency-warning-and-model-fallback.md](./04-llm-latency-warning-and-model-fallback.md) | Gemini API 과부하(503)로 인한 응답 지연 시 침묵 방치 | 원인 분석 요청 ➔ 지연 안내 UX 제안 ➔ 경량 모델(초저지연) 전환 선택 인터랙션 구현까지 점진적 스펙 오케스트레이션 |
| 05 | [05-gemini-model-swap-and-popover-ui.md](./05-gemini-model-swap-and-popover-ui.md) | Gemini 3.8 Flash 응답 지연 및 비직관적 탭 UI | 3.8 응답 상태 진단 요청 ➔ Gemini 3.1 Flash-Lite 고속 엔진 교체 및 이미지 기반 팝오버 드롭다운 UI 개편 지시 |

