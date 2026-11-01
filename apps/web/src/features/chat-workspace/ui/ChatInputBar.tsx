'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ModelType } from '@/shared/types';

interface ModelOption {
  id: ModelType;
  name: string;
  shortName: string;
  description: string;
  tag: string;
  color: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'gemini-3.1-flash-lite',
    name: '3.1 Flash-Lite',
    shortName: 'Flash',
    description: '가장 빠른 답변 제공',
    tag: 'Google',
    color: '#4cd7f6',
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: '3.5 Flash-Lite',
    shortName: '3.5 Lite',
    description: '초저지연 일상 질의 응답',
    tag: 'Google',
    color: '#ffb95f',
  },
  {
    id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    name: 'Llama 3.3 (70B)',
    shortName: 'Llama 3.3',
    description: '고급 추론 및 사내 RAG',
    tag: 'Cloudflare',
    color: '#f48120',
  },
  {
    id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    name: 'DeepSeek R1',
    shortName: 'R1',
    description: '복잡한 작업 (Thinking)',
    tag: 'Cloudflare',
    color: '#a855f7',
  },
  {
    id: '@cf/meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 (8B)',
    shortName: 'Llama 3.1',
    description: '초경량 엣지 고속 연산',
    tag: 'Cloudflare',
    color: '#ea580c',
  },
];

interface ChatInputBarProps {
  /** 텍스트 입력 엘리먼트 참조 */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onSendMessage: (text: string) => void;
  onStopGenerating: () => void;
  isGenerating: boolean;
  isDelayed?: boolean;
  modelType: ModelType;
  onChangeModel: (model: ModelType) => void;
  isListening: boolean;
  onToggleListening: () => void;
}

/**
 * 하단 캡슐형 명령 입력 및 팝오버 드롭다운 모델 스위칭 컨트롤 바
 */
export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  inputRef,
  onSendMessage,
  onStopGenerating,
  isGenerating,
  isDelayed = false,
  modelType,
  onChangeModel,
  isListening,
  onToggleListening,
}) => {
  const [inputText, setInputText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 현재 활성 모델 옵션 정보 추출
  const currentOption =
    MODEL_OPTIONS.find(
      (m) =>
        m.id === modelType ||
        (m.id === '@cf/meta/llama-3.3-70b-instruct-fp8-fast' &&
          modelType === '@cf/meta/llama-3.3-70b-instruct')
    ) || MODEL_OPTIONS[0];

  // 팝오버 외부 클릭 시 닫기 핸들러
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating) {
      onStopGenerating();
      return;
    }
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4 select-none">
      {/* 상단 컨트롤러: 실시간 텔레메트리 상태 알림 */}
      <div className="flex items-center justify-between gap-2 px-3 pb-2 text-[11px] font-mono">
        {isGenerating ? (
          isDelayed ? (
            <div className="flex items-center gap-1.5 text-[#ffb95f] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb95f] shadow-[0_0_6px_#ffb95f]" />
              <span>통신 지연 감지 (엔진 전환 가능)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[#4cd7f6] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4cd7f6] shadow-[0_0_6px_#4cd7f6]" />
              <span>스트리밍 답변 생성 중 (Barge-in 대기)</span>
            </div>
          )
        ) : (
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
            <span>SYS::STANDBY (RAG 지식 베이스 활성)</span>
          </div>
        )}
      </div>

      {/* 캡슐형 입력 폼 */}
      <form
        onSubmit={handleSubmit}
        className="relative w-full rounded-full bg-[#111827]/90 backdrop-blur-xl border border-white/[0.08] hover:border-white/20 focus-within:border-[#dc2626]/60 p-1.5 pl-5 flex items-center justify-between gap-3 shadow-[0_0_24px_rgba(0,0,0,0.6)] focus-within:shadow-[0_0_24px_rgba(220,38,38,0.35)] transition-all"
      >
        {/* 입력 태그 */}
        <div className="hidden sm:flex items-center gap-1.5 pr-1 border-r border-white/10">
          <span className="w-2 h-2 rounded-full bg-[#dc2626] shadow-[0_0_6px_#dc2626]" />
          <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
            CMD
          </span>
        </div>

        {/* 텍스트 입력창 */}
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder={
            isListening
              ? '자비서 음성 센서 수신 중... 말씀하십시오.'
              : '새 프로토콜 생성, 데이터 질의, 또는 전술 지시사항을 입력하십시오...'
          }
          className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 font-sans text-sm focus:outline-none min-w-0 tracking-wide"
        />

        {/* 액션 버튼 그룹: 모델 선택 드롭다운 -> 마이크 -> 실행 버튼 */}
        <div className="flex items-center gap-1.5">
          {/* 1. 모델 드롭다운 셀렉트 박스 (마이크 왼쪽 배치) */}
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#181d2a] hover:bg-[#22293b] text-slate-200 hover:text-white border border-white/10 hover:border-white/20 shadow-sm active:scale-95 transition-all cursor-pointer font-sans"
              aria-expanded={isMenuOpen}
              aria-label="코어 엔진 모델 선택"
            >
              <span className="font-['Space_Grotesk'] text-xs font-semibold tracking-wide text-slate-200 whitespace-nowrap">
                {currentOption.shortName}
              </span>
              <span
                className={`material-symbols-outlined text-[16px] text-slate-400 transition-transform duration-200 ${
                  isMenuOpen ? 'rotate-180' : ''
                }`}
              >
                keyboard_arrow_down
              </span>
            </button>

            {/* 위로 열리는 팝오버 드롭다운 메뉴 (사고 수준 제거) */}
            {isMenuOpen && (
              <div className="absolute bottom-full mb-3 right-0 z-50 w-64 bg-[#0f131d]/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.85)] p-1.5 flex flex-col select-none animate-in fade-in zoom-in-95 duration-150">
                {MODEL_OPTIONS.map((opt) => {
                  const isSelected =
                    modelType === opt.id ||
                    (opt.id === '@cf/meta/llama-3.3-70b-instruct-fp8-fast' &&
                      modelType === '@cf/meta/llama-3.3-70b-instruct');

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onChangeModel(opt.id);
                        setIsMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl transition-all cursor-pointer flex items-start gap-2 ${
                        isSelected
                          ? 'bg-white/[0.08] border border-white/15 shadow-[inset_0_0_10px_rgba(255,255,255,0.03)]'
                          : 'hover:bg-white/[0.05] border border-transparent'
                      }`}
                    >
                      {/* 체크마크 공간 */}
                      <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                        {isSelected ? (
                          <span className="material-symbols-outlined text-[16px] text-slate-100 font-bold">
                            check
                          </span>
                        ) : null}
                      </div>

                      {/* 모델명 & 부제목 */}
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-['Space_Grotesk'] text-[13px] font-semibold text-slate-100 leading-tight">
                            {opt.name}
                          </span>
                          <span
                            className="font-mono text-[8px] px-1.5 py-0.2 rounded font-semibold shrink-0"
                            style={{
                              backgroundColor: `${opt.color}20`,
                              color: opt.color,
                              border: `1px solid ${opt.color}35`,
                            }}
                          >
                            {opt.tag}
                          </span>
                        </div>
                        <p className="font-sans text-[11px] text-slate-400 leading-tight mt-0.5">
                          {opt.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. 음성 인식 마이크 토글 */}
          <button
            type="button"
            onClick={onToggleListening}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isListening
                ? 'bg-[#dc2626] text-white shadow-[0_0_12px_#dc2626] animate-pulse'
                : 'text-slate-400 hover:text-[#ffb95f] hover:bg-white/[0.04]'
            }`}
            title="음성 인식 활성화"
          >
            <span className="material-symbols-outlined text-[19px]">mic</span>
          </button>

          {/* 전송 또는 스트리밍 중단(Barge-in) 버튼 */}
          {isGenerating ? (
            <button
              type="button"
              onClick={onStopGenerating}
              className="h-9 px-4 rounded-full bg-[#93000a] hover:bg-[#b91c1c] text-white font-['Space_Grotesk'] text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_16px_rgba(220,38,38,0.5)] active:scale-95 transition-all cursor-pointer"
              title="답변 생성 즉시 중단"
            >
              <span className="material-symbols-outlined text-[16px]">stop</span>
              <span>중단</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="h-9 px-4 rounded-full bg-[#dc2626] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#b91c1c] text-white font-['Space_Grotesk'] text-xs uppercase tracking-wider flex items-center gap-1 shadow-[0_0_16px_rgba(220,38,38,0.45)] hover:shadow-[0_0_24px_rgba(220,38,38,0.8)] active:scale-95 transition-all cursor-pointer"
              title="명령 전송"
            >
              <span className="hidden sm:inline">실행</span>
              <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
