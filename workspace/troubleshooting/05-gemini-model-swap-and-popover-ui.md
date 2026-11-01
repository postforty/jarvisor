# 05. Gemini 3.8 Flash 지연 해소 및 Gemini 3.1 Flash Lite 교체와 팝오버 드롭다운 UI 전환

## 1. 문제 상황
- **증상**: 기존 기본 모델인 `gemini-3.8-flash` 호출 시 응답 대기 시간이 12초 이상 소요되거나 타임아웃 및 503 과부하가 발생함.
- **추가 시도**: `gemini-4-argon` 적용 검토 시 무료 티어(Free Tier) 환경에서 `429 RESOURCE_EXHAUSTED (limit: 0)`가 발생하여 사용 불가함.
- **UI 문제**: 기존 모델 선택기가 가로 스크롤 버튼 형태로 되어 있어 대화창 입력 영역을 과도하게 차지하고 조작 편의성이 떨어짐.

---

## 2. 개발자 프롬프트 및 지시 의도

### 프롬프트 1
```text
3.8 모델이 제대로 동작하지 않는 것 같아. 아래 문서를 참고하여 모델을 변경해줘
```
- **의도**: 모델 응답 불량 원인을 파악하고 신규/대체 고성능 모델 적용 가능 여부를 진단하도록 유도.

### 프롬프트 2
```text
gemini-3.8-flash 이 응답하고 있을까?
```
- **의도**: 현재 `gemini-3.8-flash`의 실제 응답 상태 및 지연 지표(TTFT, 소요 시간)를 직접 측정하고 확인할 것을 요구.

### 프롬프트 3
```text
gemini-3.8-flash -> Gemini 3.1 Flash Lite 로 교체하고, 모델 선택을 그림과 같은 UI 형식으로 변경해줘.@[d:\wsh\vibe-coding\ch14\jarvisor\DESIGN.md] 준수해
```
- **의도**:
  1. 지연이 심한 구형 3.8 모델을 초고속(TTFT ~0.8s) 응답이 검증된 `Gemini 3.1 Flash Lite`(`gemini-3.1-flash-lite`)로 백엔드/프런트엔드 전반에 걸쳐 교체.
  2. UI를 첨부 이미지 형태의 컴팩트 캡슐형 트리거 버튼과 상단으로 펼쳐지는 체크마크/부제목/구분선/사고 수준 메뉴를 갖춘 팝오버 드롭다운으로 개편하고 [DESIGN.md](../../DESIGN.md) 테마를 완벽히 준수하도록 지시.

---

## 3. 해결 조치

### 1) 백엔드 모델 교체 및 하위 호환성 확보
- [apps/api/app/schemas/chat.py](../../apps/api/app/schemas/chat.py): `ModelType.DEFAULT`를 `"gemini-3.1-flash-lite"`로 변경하고 기존 3.8은 레거시 호환으로 보존.
- [apps/api/app/core/config.py](../../apps/api/app/core/config.py): `GEMINI_DEFAULT_MODEL`을 `"gemini-3.1-flash-lite"`로 설정.
- [apps/api/app/models/session.py](../../apps/api/app/models/session.py): 세션 기본 모델명을 `"gemini-3.1-flash-lite"`로 갱신.
- [apps/api/app/services/llm_service.py](../../apps/api/app/services/llm_service.py): `gemini-3.1-flash-lite` 팩토리 등록 및 `gemini-3.8-flash`와 1:1 고유 인스턴스 분리(오해를 일으키는 3.8 ➔ 3.1 변조 매핑 제거).

### 2) 프런트엔드 팝오버 드롭다운 UI 개편
- [apps/web/src/features/chat-workspace/ui/ChatInputBar.tsx](../../apps/web/src/features/chat-workspace/ui/ChatInputBar.tsx):
  - 인풋 폼 내부 액션 영역(마이크 버튼의 바로 왼쪽)에 둥근 캡슐형 드롭다운 버튼(`3.5 Lite ∨`) 배치.
  - 클릭 시 상단으로 부드럽게 열리는 팝오버 드롭다운 카드(`rounded-2xl`, 다크 글래스모피즘) 구축.
  - 선택 항목 체크마크(`✓`), 모델명/부제목(`가장 빠른 답변 제공`, `초저지연 일상 질의 응답`, `고급 추론 및 사내 RAG`, `복잡한 작업`) 표시 및 불필요한 '사고 수준' 하단 메뉴 완전 제거.
  - 팝오버 외부 영역 클릭 감지(`handleClickOutside`)로 자동 닫기 처리.
- [apps/web/src/shared/ui/Header.tsx](../../apps/web/src/shared/ui/Header.tsx), [apps/web/src/features/system-settings/ui/SettingsPanel.tsx](../../apps/web/src/features/system-settings/ui/SettingsPanel.tsx), [apps/web/src/features/chat-workspace/ui/MessageList.tsx](../../apps/web/src/features/chat-workspace/ui/MessageList.tsx): 활성 모델 뱃지 및 설정 라벨을 `3.1 Flash-Lite`로 일관되게 동기화.

---

## 4. 검증 및 교훈

### 검증 결과
1. **백엔드 테스트**: `npm run test:api` ➔ **23 passed in 3.25s** (RAG 연동 및 모든 모델 팩토리 검증 통과)
2. **프런트엔드 린트 및 빌드**: `npm run lint` ➔ **에러 0건**, `npm run build` ➔ **Next.js 16 프로덕션 빌드 성공**

### 교훈
- **실제 환경 Quota 검증의 중요성**: 플래그십 모델이라도 API Key 계정 등급(Free vs Pay-as-you-go)에 따라 쿼터가 0일 수 있으므로 사전 헬스체크로 가용성을 실측한 후 적용해야 함.
- **이미지 기반 UI 요구사항 정밀 분석**: 첨부 이미지의 세부 시각 요소(체크마크 위치 정렬, 서브타이틀 줄바꿈, 구분선, 서브메뉴 캐럿)를 분석하여 디자인 가이드라인(`DESIGN.md`)과 융합함으로써 직관적이고 완성도 높은 UX를 구현할 수 있음.
