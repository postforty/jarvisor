'use client';

import React, { useEffect, useRef } from 'react';
import { ChatMessage, ModelType } from '@/shared/types';

interface MessageListProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  isDelayed?: boolean;
  currentModel?: ModelType;
  onSwitchModel?: (model: ModelType) => void;
  onDismissDelay?: () => void;
}

/**
 * 실시간 HUD 대화 메시지 스트림 뷰 컴포넌트
 */
export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isGenerating,
  isDelayed = false,
  currentModel = 'gemini-3.1-flash-lite',
  onSwitchModel,
  onDismissDelay,
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating, isDelayed]);

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6 overflow-y-auto">
      {messages.map((msg, index) => {
        const isUser = msg.role === 'user';
        const isLatestAssistant = !isUser && index === messages.length - 1;
        const showDelayNotice =
          isLatestAssistant && isGenerating && isDelayed && !msg.content && !msg.errorInfo;

        // 모델 과부하(503) 또는 통신 오류 감지
        const hasOverloadError =
          Boolean(msg.errorInfo?.isOverloaded) ||
          msg.content.includes('503 UNAVAILABLE') ||
          msg.content.includes('high demand') ||
          (msg.content.includes('[코어 텔레메트리 알림]') && msg.content.includes('503'));

        const hasGeneralError = Boolean(msg.errorInfo && !hasOverloadError);

        return (
          <div
            key={msg.id}
            className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}
          >
            {/* 발화자 헤더 및 메타데이터 */}
            <div className="flex items-center gap-2 px-1">
              {!isUser && (
                <div className="w-2 h-2 rounded-full bg-[#4cd7f6] shadow-[0_0_6px_#4cd7f6]" />
              )}
              <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                {isUser ? 'T. STARK' : 'JARVISOR MK-85'}
              </span>
              {!isUser && msg.model && (
                <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-[#171b26] text-[#4cd7f6] border border-[#4cd7f6]/30">
                  {msg.model.includes('3.1-flash')
                    ? '3.1 FLASH-LITE'
                    : msg.model.includes('3.5-flash')
                    ? '3.5 LITE'
                    : msg.model.includes('llama')
                    ? 'LLAMA'
                    : 'CORE'}
                </span>
              )}
              <span className="font-mono text-[10px] text-slate-500">{msg.timestamp}</span>
            </div>

            {/* 메시지 본문 버블 */}
            <div
              className={`max-w-[90%] md:max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed whitespace-pre-wrap break-words transition-all ${
                isUser
                  ? 'bg-[#1c1f2a] text-slate-100 border border-white/[0.08] shadow-[0_4px_16px_rgba(0,0,0,0.3)] rounded-tr-sm'
                  : hasOverloadError
                    ? 'bg-[#171b26]/95 text-slate-100 border border-[#ffb95f]/50 shadow-[0_0_20px_rgba(255,185,95,0.15)] rounded-tl-sm'
                    : 'bg-[#0f131d]/90 text-slate-100 border border-[#dc2626]/25 shadow-[0_0_16px_rgba(220,38,38,0.1)] rounded-tl-sm'
              }`}
            >
              {/* 1. 모델 과부하(503) 에러 시: 모델 전환 재시도 카드 유지 */}
              {hasOverloadError ? (
                <div className="flex flex-col gap-3 py-1 text-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#ffb95f] shadow-[0_0_8px_#ffb95f]" />
                    <span className="font-mono text-xs font-semibold tracking-wider text-[#ffb95f] uppercase">
                      TELEMETRY // MODEL OVERLOAD (503)
                    </span>
                  </div>
                  <div className="text-xs md:text-sm text-slate-300 space-y-1">
                    <p className="font-medium text-amber-200">
                      <span className="font-semibold text-white">표준 지능 (3.8 Flash)</span> 모델의 일시적인 글로벌 트래픽 급증으로 응답 생성에 실패했습니다.
                    </p>
                    <p className="text-slate-400 text-xs">
                      대기 시간 없이 즉시 응답이 가능한 초저지연 (3.5 Lite) 모델로 전환하여 답변을 생성하시겠습니까?
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {onSwitchModel && (
                      <button
                        type="button"
                        onClick={() => onSwitchModel('gemini-3.5-flash-lite')}
                        className="px-3.5 py-1.5 rounded-lg bg-[#ffb95f] hover:bg-[#e0a04b] text-[#2a1700] font-['Space_Grotesk'] text-xs font-bold tracking-wide shadow-[0_0_12px_rgba(255,185,95,0.4)] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">bolt</span>
                        <span>초저지연 (3.5 Lite) 모델로 전환하여 재시도</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : showDelayNotice ? (
                /* 2. 서비스 응답 지연 중(4초 초과)일 때: 지연 안내 및 모델 전환 카드 */
                <div className="flex flex-col gap-3 py-1 text-slate-200">
                  {/* 지연 알림 헤더 */}
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffb95f] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ffb95f]" />
                    </span>
                    <span className="font-mono text-xs font-semibold tracking-wider text-[#ffb95f] uppercase">
                      TELEMETRY // LATENCY WARNING
                    </span>
                  </div>

                  {/* 지연 상세 안내 */}
                  <div className="text-xs md:text-sm text-slate-300 space-y-1">
                    <p className="font-medium text-amber-200">
                      현재{' '}
                      <span className="font-semibold text-white">
                        {currentModel === 'gemini-3.8-flash'
                          ? '표준 지능 (3.8 Flash)'
                          : '현재 코어'}
                      </span>{' '}
                      모델의 글로벌 트래픽 급증으로 인해 응답이 지연되고 있습니다.
                    </p>
                    <p className="text-slate-400 text-xs">
                      더 빠르고 경제적인 경량 엔진으로 즉시 전환하여 답변을 생성하시겠습니까?
                    </p>
                  </div>

                  {/* 모델 전환 인터랙션 액션 버튼 */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {currentModel === 'gemini-3.8-flash' && onSwitchModel && (
                      <button
                        type="button"
                        onClick={() => onSwitchModel('gemini-3.5-flash-lite')}
                        className="px-3.5 py-1.5 rounded-lg bg-[#ffb95f] hover:bg-[#e0a04b] text-[#2a1700] font-['Space_Grotesk'] text-xs font-bold tracking-wide shadow-[0_0_12px_rgba(255,185,95,0.4)] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">bolt</span>
                        <span>초저지연 (3.5 Lite) 모델로 전환</span>
                      </button>
                    )}
                    {onDismissDelay && (
                      <button
                        type="button"
                        onClick={onDismissDelay}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/10 text-slate-400 hover:text-slate-200 text-xs font-sans border border-white/10 active:scale-95 transition-all cursor-pointer"
                      >
                        계속 대기
                      </button>
                    )}
                  </div>
                </div>
              ) : hasGeneralError ? (
                /* 3. 일반 에러 발생 시 */
                <div className="flex flex-col gap-2 py-1 text-red-300">
                  <div className="flex items-center gap-2 text-[#ffb4ab]">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    <span className="font-mono text-xs font-semibold">통신 링크 결함</span>
                  </div>
                  <p className="text-xs text-slate-300">{msg.errorInfo?.message}</p>
                </div>
              ) : (
                /* 4. 정상 텍스트 및 스트리밍 타이핑 */
                <>
                  {msg.content}
                  {/* 타이핑 중 커서 효과 */}
                  {isLatestAssistant && isGenerating && (
                    <span className="inline-block w-2 h-4 ml-1 bg-[#4cd7f6] shadow-[0_0_8px_#4cd7f6] animate-typing-cursor align-middle" />
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
