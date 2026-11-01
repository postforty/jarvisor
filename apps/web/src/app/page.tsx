'use client';

import React, { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sidebar } from '@/shared/ui/Sidebar';
import { Header } from '@/shared/ui/Header';
import { MobileNav } from '@/shared/ui/MobileNav';
import { ChatWorkspace } from '@/features/chat-workspace/ui/ChatWorkspace';
import { useChatStream } from '@/features/chat-workspace/model/useChatStream';

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionParam = searchParams.get('session');
  const chatStream = useChatStream();
  const { loadSession } = chatStream;

  // URL 쿼리에 session_id가 유입되면 해당 세션 메시지 복원
  useEffect(() => {
    if (sessionParam) {
      loadSession(sessionParam);
    }
  }, [sessionParam, loadSession]);

  const handleNewSession = () => {
    chatStream.clearSession();
    // 쿼리 스트링을 제거하고 신규 세션 URL로 변경
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[#08090C] text-[#dfe2f1] flex flex-col md:flex-row">
      {/* 데스크톱 사이드바 */}
      <Sidebar onNewSession={handleNewSession} />

      {/* 메인 뷰 컨테이너 (사이드바 폭만큼 패딩) */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* 상단 헤더 */}
        <Header
          onNewSession={handleNewSession}
          activeModel={chatStream.modelType}
          isGenerating={chatStream.isGenerating}
        />

        {/* 대화 워크스페이스 */}
        <main className="flex-1 flex flex-col">
          <ChatWorkspace chatStream={chatStream} />
        </main>

        {/* 모바일 하단 탭 내비게이션 */}
        <MobileNav />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#08090C] flex items-center justify-center text-slate-400 font-mono text-xs">
          INITIALIZING PROTOCOL...
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
