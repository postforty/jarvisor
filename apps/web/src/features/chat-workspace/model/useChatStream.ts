'use client';

import { useState, useRef, useCallback } from 'react';
import { ChatMessage, ModelType, PersonaType } from '@/shared/types';

interface UseChatStreamOptions {
  initialPersona?: PersonaType;
  initialModel?: ModelType;
}

// 응답 지연 판단 임계 시간 (4초 초과 시 서비스 지연 안내)
const DELAY_THRESHOLD_MS = 4000;

/**
 * 실시간 SSE 대화 스트리밍, Barge-in 중단, 서비스 지연 감지 및 모델 전환 제어 훅
 */
export function useChatStream({
  initialPersona = 'classic',
  initialModel = 'gemini-3.1-flash-lite',
}: UseChatStreamOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [modelType, setModelType] = useState<ModelType>(initialModel);
  const [persona, setPersona] = useState<PersonaType>(initialPersona);
  const [isDelayed, setIsDelayed] = useState<boolean>(false);
  // 세션 초기화(리셋) 횟수 추적 상태 (인풋창 자동 포커스 트리거용)
  const [resetCount, setResetCount] = useState<number>(0);

  // 진행 중인 스트리밍 요청 AbortController 참조
  const abortControllerRef = useRef<AbortController | null>(null);
  // 서비스 지연 감지 타이머 참조
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 모델 전환 재시도를 위한 마지막 사용자 메시지 참조
  const lastUserMessageRef = useRef<string>('');

  /**
   * 타이머 정리 헬퍼
   */
  const clearDelayTimer = useCallback(() => {
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
  }, []);

  /**
   * 실시간 스트리밍 답변 생성 즉시 중단 (Barge-in)
   */
  const stopGenerating = useCallback(() => {
    clearDelayTimer();
    setIsDelayed(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  }, [clearDelayTimer]);

  /**
   * 지연 안내 알림 수동 닫기 (계속 대기 선택 시)
   */
  const dismissDelayNotice = useCallback(() => {
    setIsDelayed(false);
  }, []);

  /**
   * 내부 공통 스트리밍 요청 실행 함수
   */
  const executeStreamRequest = useCallback(
    async (
      text: string,
      targetModel: ModelType,
      assistantMessageId: string
    ) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 4초 후에도 첫 텍스트 청크가 없으면 서비스 지연 상태 플래그 활성화
      clearDelayTimer();
      delayTimerRef.current = setTimeout(() => {
        setIsDelayed(true);
      }, DELAY_THRESHOLD_MS);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/api/v1/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: text,
            session_id: sessionId,
            model_type: targetModel,
            persona: persona,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API 응답 실패 (HTTP ${response.status})`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('스트림 리더를 초기화할 수 없습니다.');

        const decoder = new TextDecoder('utf-8');
        let accumulatedText = '';
        let hasReceivedFirstChunk = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunkStr = decoder.decode(value, { stream: true });
          const eventBlocks = chunkStr.split('\n\n');

          for (const block of eventBlocks) {
            const cleanLine = block.trim();
            if (!cleanLine.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(cleanLine.replace('data: ', ''));

              if (data.type === 'chunk' && data.text) {
                // 첫 유효 청크 도착 시 지연 타이머 및 지연 알림 즉시 해제
                if (!hasReceivedFirstChunk) {
                  hasReceivedFirstChunk = true;
                  clearDelayTimer();
                  setIsDelayed(false);
                }

                accumulatedText += data.text;
                // 세션 ID 갱신
                if (data.session_id && !sessionId) {
                  setSessionId(data.session_id);
                }
                // 실시간 텍스트 누적 반영
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: accumulatedText }
                      : msg
                  )
                );
              } else if (data.type === 'done') {
                if (data.session_id) setSessionId(data.session_id);
              } else if (data.type === 'error') {
                const errorText = data.message || '';
                const isOverloaded =
                  errorText.includes('503') ||
                  errorText.includes('high demand') ||
                  errorText.includes('UNAVAILABLE') ||
                  errorText.includes('과부하');

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          errorInfo: {
                            message: errorText,
                            isOverloaded,
                          },
                        }
                      : msg
                  )
                );
              }
            } catch {
              // JSON 파싱 에러는 무시하고 다음 청크 처리
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          // 사용자가 의도적으로 중단한 경우
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content ? `${msg.content} [중단됨]` : '[응답 중단됨]' }
                : msg
            )
          );
        } else {
          const errorMsg =
            err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
          const isOverloaded =
            errorMsg.includes('503') ||
            errorMsg.includes('high demand') ||
            errorMsg.includes('UNAVAILABLE') ||
            errorMsg.includes('과부하');

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    errorInfo: {
                      message: errorMsg,
                      isOverloaded,
                    },
                  }
                : msg
            )
          );
        }
      } finally {
        clearDelayTimer();
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [clearDelayTimer, persona, sessionId]
  );

  /**
   * 새 메시지 전송 및 실시간 SSE 스트리밍 수신
   */
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isGenerating) return;

      // 만약 이전 스트리밍이 살아있다면 중단
      stopGenerating();

      lastUserMessageRef.current = trimmed;
      const userMessageId = `msg-${Date.now()}`;
      const assistantMessageId = `msg-${Date.now() + 1}`;

      const userMessage: ChatMessage = {
        id: userMessageId,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      const assistantPlaceholder: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        model: modelType,
      };

      // 화면에 사용자 메시지 및 빈 어시스턴트 메시지 즉시 추가
      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
      setIsGenerating(true);
      setIsDelayed(false);

      await executeStreamRequest(trimmed, modelType, assistantMessageId);
    },
    [executeStreamRequest, isGenerating, modelType, stopGenerating]
  );

  /**
   * 지연 발생 시 대체 모델(초저지연 등)로 전환하여 마지막 질의 즉시 재시도
   */
  const retryWithAlternativeModel = useCallback(
    async (newModel: ModelType) => {
      const promptText = lastUserMessageRef.current;
      if (!promptText) return;

      // 기존 지연 요청 중단
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      clearDelayTimer();
      setIsDelayed(false);

      // 모델 타입 변경
      setModelType(newModel);

      // 마지막 미완성 어시스턴트 버블을 새 모델의 빈 버블로 교체
      const newAssistantId = `msg-${Date.now()}`;
      setMessages((prev) => {
        // 마지막 메시지가 assistant인 경우 교체, 아니면 신규 추가
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMsg,
              id: newAssistantId,
              model: newModel,
              content: '',
              errorInfo: undefined,
            },
          ];
        }
        return prev;
      });

      setIsGenerating(true);
      await executeStreamRequest(promptText, newModel, newAssistantId);
    },
    [clearDelayTimer, executeStreamRequest]
  );

  /**
   * 새 대화 세션 초기화
   */
  const clearSession = useCallback(() => {
    stopGenerating();
    setMessages([]);
    setSessionId(null);
    lastUserMessageRef.current = '';
    // 세션 초기화 카운트를 증가시켜 입력창 포커스 트리거
    setResetCount((prev) => prev + 1);
  }, [stopGenerating]);

  return {
    messages,
    isGenerating,
    isDelayed,
    sessionId,
    modelType,
    setModelType,
    persona,
    setPersona,
    sendMessage,
    stopGenerating,
    retryWithAlternativeModel,
    dismissDelayNotice,
    clearSession,
    resetCount,
  };
}
