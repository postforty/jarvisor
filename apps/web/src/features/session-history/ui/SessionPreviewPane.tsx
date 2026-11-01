'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SessionDetail } from '../model/useSessionHistory';
import { ChatMessage } from '@/shared/types';

interface SessionPreviewPaneProps {
  sessionDetail: SessionDetail | null;
  onDeleteSession: (id: string) => void;
  onExportSession: (id: string) => void;
}

/**
 * 우측 고정 세션 상세 텔레메트리 및 프리뷰 패널
 */
export const SessionPreviewPane: React.FC<SessionPreviewPaneProps> = ({
  sessionDetail,
  onDeleteSession,
  onExportSession,
}) => {
  const [copied, setCopied] = useState(false);

  if (!sessionDetail) {
    return (
      <aside className="p-8 rounded-2xl bg-[#0a0e18]/80 border border-white/[0.06] flex flex-col items-center justify-center text-center select-none min-h-[360px]">
        <span className="material-symbols-outlined text-[42px] text-slate-600 mb-3">
          info_sparkle
        </span>
        <p className="font-['Space_Grotesk'] text-sm text-slate-300 font-semibold">
          선택된 세션이 없습니다.
        </p>
        <span className="font-mono text-xs text-slate-500 mt-1">
          좌측 타임라인에서 검토할 세션을 선택하십시오.
        </span>
      </aside>
    );
  }

  const handleCopySummary = () => {
    const textToCopy =
      sessionDetail.summary ||
      sessionDetail.messages?.map((m: ChatMessage) => `${m.role}: ${m.content}`).join('\n') ||
      sessionDetail.title;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="p-6 rounded-2xl bg-[#0e121a]/90 backdrop-blur-xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex flex-col gap-6 select-none max-h-[calc(100vh-6rem)] overflow-y-auto">
      {/* 상단 세션 코드 & 모델 배지 */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <span className="font-mono text-xs text-[#4cd7f6] font-semibold">
          #{sessionDetail.id}
        </span>
        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#1c1f2a] text-[#ffb95f] border border-white/10 uppercase">
          {sessionDetail.model}
        </span>
      </div>

      {/* 세션 제목 */}
      <div className="flex flex-col gap-1">
        <h3 className="font-['Space_Grotesk'] text-lg font-bold text-slate-100 tracking-tight leading-snug">
          {sessionDetail.title}
        </h3>
        <span className="font-mono text-[11px] text-slate-500">
          기록 일시: {new Date(sessionDetail.createdAt).toLocaleString('ko-KR')}
        </span>
      </div>

      {/* 세션 요약 또는 브리핑 내용 */}
      <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-[#08090C]/80 border border-white/[0.04]">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 font-semibold">
          <span>세션 요약 리포트</span>
          <button
            onClick={handleCopySummary}
            className="flex items-center gap-1 text-[#ffb95f] hover:text-white transition-colors cursor-pointer text-[10px]"
          >
            <span className="material-symbols-outlined text-[14px]">
              {copied ? 'check' : 'content_copy'}
            </span>
            {copied ? '복사됨' : '요약 복사'}
          </button>
        </div>
        <p className="font-sans text-xs text-slate-300 leading-relaxed">
          {sessionDetail.summary ||
            '이 세션은 사용자와의 실시간 작전 회의로 구성되어 있으며, 자비서 신경망을 통해 컴파일된 텔레메트리 로그입니다.'}
        </p>
      </div>

      {/* 대화 메시지 프리뷰 (최대 8개) */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11px] text-slate-400 font-semibold">
          대화 흐름 ({sessionDetail.messages?.length || 0})
        </span>
        <div className="max-h-48 overflow-y-auto flex flex-col gap-2 pr-1">
          {sessionDetail.messages?.slice(0, 8).map((m: ChatMessage) => (
            <div
              key={m.id}
              className={`p-2.5 rounded-lg text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[#1c1f2a] text-slate-200 border-l-2 border-[#dc2626]'
                  : 'bg-[#121620] text-slate-300 border-l-2 border-[#4cd7f6]'
              }`}
            >
              <div className="font-mono text-[9px] text-slate-500 mb-0.5 uppercase">
                {m.role === 'user' ? 'USER' : 'JARVISOR'}
              </div>
              <p className="line-clamp-2">{m.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 액션 컨트롤 버튼들 */}
      <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
        {/* 이 세션 이어서 대화 */}
        <Link
          href={`/?session=${sessionDetail.id}`}
          className="flex-1 py-2.5 px-3 rounded-lg bg-[#dc2626] hover:bg-[#b91c1c] text-white font-['Space_Grotesk'] text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(220,38,38,0.35)] transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">play_arrow</span>
          <span>이어서 대화</span>
        </Link>

        {/* JSON 내보내기 */}
        <button
          onClick={() => onExportSession(sessionDetail.id)}
          className="p-2.5 rounded-lg bg-[#171b26] hover:bg-[#262a35] text-slate-300 hover:text-white transition-colors cursor-pointer border border-white/[0.06]"
          title="세션 JSON 다운로드"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
        </button>

        {/* 세션 삭제 */}
        <button
          onClick={() => onDeleteSession(sessionDetail.id)}
          className="p-2.5 rounded-lg bg-[#171b26] hover:bg-[#93000a] text-slate-400 hover:text-white transition-colors cursor-pointer border border-white/[0.06]"
          title="세션 삭제"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>
    </aside>
  );
};
