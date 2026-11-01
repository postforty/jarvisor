'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/shared/ui/Sidebar';
import { Header } from '@/shared/ui/Header';
import { MobileNav } from '@/shared/ui/MobileNav';
import { useSessionHistory } from '@/features/session-history/model/useSessionHistory';
import { HistorySearchFilter } from '@/features/session-history/ui/HistorySearchFilter';
import { HistoryTimeline } from '@/features/session-history/ui/HistoryTimeline';
import { SessionPreviewPane } from '@/features/session-history/ui/SessionPreviewPane';

export default function HistoryPage() {
  const router = useRouter();
  const {
    sessions,
    selectedSessionId,
    setSelectedSessionId,
    selectedDetail,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    toggleBookmark,
    deleteSession,
    exportSession,
  } = useSessionHistory();

  const handleNewSession = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[#08090C] text-[#dfe2f1] flex flex-col md:flex-row">
      {/* 데스크톱 사이드바 */}
      <Sidebar onNewSession={handleNewSession} />

      {/* 메인 컨텐츠 영역 */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        <Header onNewSession={handleNewSession} />

        <main className="flex-1 w-full pt-16 pb-20 md:pb-12 px-4 md:px-8 max-w-[1600px] mx-auto flex flex-col gap-6">
          {/* 상단 검색 및 탭 필터 */}
          <HistorySearchFilter
            totalCount={sessions.length}
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            searchQuery={searchQuery}
            onChangeSearch={setSearchQuery}
          />

          {/* 데스크톱 2-컬럼 반응형 레이아웃 (7:5) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* 좌측 7-컬럼: 세션 타임라인 스트림 */}
            <div className="lg:col-span-7">
              <HistoryTimeline
                sessions={sessions}
                selectedId={selectedSessionId}
                onSelectSession={setSelectedSessionId}
                onToggleBookmark={toggleBookmark}
              />
            </div>

            {/* 우측 5-컬럼: 선택된 세션 상세 프리뷰 (데스크톱 스크롤 시 스티키 고정) */}
            <div className="lg:col-span-5 lg:sticky lg:top-20">
              <SessionPreviewPane
                sessionDetail={selectedDetail}
                onDeleteSession={deleteSession}
                onExportSession={exportSession}
              />
            </div>
          </div>
        </main>

        {/* 모바일 하단 탭 */}
        <MobileNav />
      </div>
    </div>
  );
}
