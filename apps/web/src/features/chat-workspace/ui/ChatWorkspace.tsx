'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArcReactorCore } from '@/shared/ui/ArcReactorCore';
import { MessageList } from './MessageList';
import { ChatInputBar } from './ChatInputBar';
import { useChatStream } from '../model/useChatStream';

interface ChatWorkspaceProps {
  /** 외부에서 주입된 채팅 스트림 인스턴스 (선택적) */
  chatStream?: ReturnType<typeof useChatStream>;
}

/**
 * 자비서 메인 대화 워크스페이스 컨테이너
 */
export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  chatStream: externalChatStream,
}) => {
  const [isListening, setIsListening] = useState(false);
  const internalChatStream = useChatStream();
  const inputRef = useRef<HTMLInputElement>(null);

  // 상위에서 전달된 chatStream이 있으면 우선 사용하고 없으면 내부 인스턴스 사용
  const {
    messages,
    isGenerating,
    isDelayed,
    isLoadingSession,
    modelType,
    setModelType,
    sendMessage,
    stopGenerating,
    retryWithAlternativeModel,
    dismissDelayNotice,
    resetCount,
  } = externalChatStream || internalChatStream;

  // 새로운 세션이 생성되거나 컴포넌트 마운트 시 하단 인풋창에 커서 위치 (포커스)
  useEffect(() => {
    inputRef.current?.focus();
  }, [resetCount]);

  const handleToggleListening = () => {
    setIsListening((prev) => !prev);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 flex flex-col justify-between w-full h-[calc(100vh-4rem)] pt-16 pb-16 md:pb-0 overflow-hidden relative">
      {/* 백그라운드 앰비언트 글로우 오버레이 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_60%_at_50%_-10%,rgba(185,28,28,0.14),rgba(8,9,12,0))]" />
        <div className="absolute bottom-0 inset-x-0 h-96 bg-[radial-gradient(circle_at_50%_100%,rgba(220,38,38,0.08),transparent_70%)]" />
      </div>

      {/* 중앙 메인 컨텐츠 영역 */}
      <div className="flex-1 w-full flex flex-col justify-center items-center z-10 overflow-y-auto">
        {isLoadingSession ? (
          /* 세션 복원 로딩 상태 */
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[#dc2626] border-t-transparent animate-spin" />
            <span className="font-mono text-xs text-slate-400">
              세션 텔레메트리 복원 중...
            </span>
          </div>
        ) : !hasMessages ? (
          /* 대기 상태: 대형 아크 리액터 코어 + 타이틀 */
          <div className="w-full max-w-4xl mx-auto px-4 py-8 flex flex-col items-center">
            {/* 상단 텔레메트리 뱃지 */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#171b26] border border-white/[0.08] shadow-[0_0_12px_rgba(220,38,38,0.15)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626] animate-ping" />
                <span className="font-mono text-[10px] text-[#ffb4ab] tracking-widest uppercase">
                  SYSTEM ONLINE // MK-85
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#171b26] border border-white/[0.08] shadow-[0_0_12px_rgba(76,215,246,0.1)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4cd7f6]" />
                <span className="font-mono text-[10px] text-[#4cd7f6] tracking-widest uppercase">
                  NEURAL LINK STABLE
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#171b26] border border-white/[0.08]">
                <span className="font-mono text-[10px] text-[#ffb95f] tracking-widest uppercase">
                  LATENCY: 0.14MS
                </span>
              </div>
            </div>

            {/* 아크 리액터 코어 */}
            <div className="mb-6">
              <ArcReactorCore
                size="lg"
                isGenerating={isGenerating}
                isListening={isListening}
              />
            </div>

            {/* 메인 타이틀 블록 */}
            <div className="flex flex-col items-center text-center gap-1.5">
              <h1 className="font-['Space_Grotesk'] text-2xl md:text-3xl font-bold tracking-tight text-slate-100">
                무엇을 도와드릴까요,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#dc2626] via-[#ffb95f] to-[#dc2626]">
                  보스?
                </span>
              </h1>
              <p className="font-sans text-xs md:text-sm text-slate-400 tracking-wide">
                자비서(jarvisor) 지능형 개인 비서 대기 중. 명령을 수신할 준비가 되었습니다.
              </p>
            </div>
          </div>
        ) : (
          /* 대화 스트림 상태: 상단 미니 HUD + 메시지 목록 */
          <div className="w-full flex-1 flex flex-col justify-between overflow-hidden">
            <div className="py-2 px-4 border-b border-white/[0.06] bg-[#0a0e18]/60 flex items-center justify-between text-[11px] font-mono">
              <div className="flex items-center gap-2">
                <ArcReactorCore size="sm" isGenerating={isGenerating} />
                <span className="text-[#4cd7f6] font-semibold">JARVISOR PROTOCOL ACTIVE</span>
              </div>
              <span className="text-slate-400">SESSION MESSAGES: {messages.length}</span>
            </div>
            <MessageList
              messages={messages}
              isGenerating={isGenerating}
              isDelayed={isDelayed}
              currentModel={modelType}
              onSwitchModel={retryWithAlternativeModel}
              onDismissDelay={dismissDelayNotice}
            />
          </div>
        )}
      </div>

      {/* 하단 고정 입력 컨트롤 바 */}
      <div className="w-full z-20 bg-gradient-to-t from-[#08090C] via-[#08090C]/90 to-transparent pt-3">
        <ChatInputBar
          inputRef={inputRef}
          onSendMessage={sendMessage}
          onStopGenerating={stopGenerating}
          isGenerating={isGenerating}
          isDelayed={isDelayed}
          modelType={modelType}
          onChangeModel={setModelType}
          isListening={isListening}
          onToggleListening={handleToggleListening}
        />
      </div>
    </div>
  );
};
