'use client';

import React from 'react';
import { useSystemSettings } from '../model/useSystemSettings';
import { PersonaType } from '@/shared/types';

/**
 * Kinetic Arc HUD 기반 시스템 설정 패널 컴포넌트
 */
export const SettingsPanel: React.FC = () => {
  const { settings, updateSetting, isSaved, resetAllData } = useSystemSettings();

  const personas: { id: PersonaType; title: string; desc: string }[] = [
    {
      id: 'classic',
      title: '클래식 자비스',
      desc: '정중하고 신사적인 어조와 명확한 논리 위주의 브리핑 ("보스" 호칭)',
    },
    {
      id: 'brief',
      title: '간결한 브리핑',
      desc: '군더더기 없는 핵심 단문 중심의 즉시 정보 전달 (개조식)',
    },
    {
      id: 'tactical',
      title: '전술 브리핑',
      desc: '위협 수준, 수치, 텔레메트리 상태를 강조하는 단호한 군사/보안 어조',
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 select-none">
      {/* 헤더 타이틀 및 저장 상태 인디케이터 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.08]">
        <div>
          <h1 className="font-['Space_Grotesk'] text-2xl font-bold text-slate-100 tracking-tight">
            시스템 환경 설정
          </h1>
          <p className="font-sans text-xs text-slate-400 mt-1">
            자비서 어시스턴트의 페르소나, 엔진 성능, 자율 조치 권한 및 보안 규칙을 설정합니다.
          </p>
        </div>

        {isSaved && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#10241b] border border-emerald-500/40 text-emerald-400 text-xs font-mono animate-pulse">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>설정이 적용되었습니다</span>
          </div>
        )}
      </div>

      {/* 1. 페르소나 & 음성 섹션 */}
      <section className="bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-white/[0.08] p-5 md:p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#ff4444] text-[22px]">
              record_voice_over
            </span>
            <h2 className="font-['Space_Grotesk'] text-base font-semibold text-slate-100">
              페르소나 &amp; 음성
            </h2>
          </div>
          <span className="font-mono text-xs text-[#4cd7f6]">
            현재: {personas.find((p) => p.id === settings.persona)?.title}
          </span>
        </div>

        {/* 페르소나 선택 카드 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {personas.map((p) => {
            const isSelected = settings.persona === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => updateSetting('persona', p.id)}
                className={`text-left p-4 rounded-xl transition-all flex flex-col justify-between gap-2 border cursor-pointer ${isSelected
                    ? 'bg-[#1c1f2a] border-[#dc2626]/60 shadow-[0_0_16px_rgba(220,38,38,0.2)]'
                    : 'bg-[#0a0e18]/80 hover:bg-[#171b26] border-white/[0.06]'
                  }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`font-['Space_Grotesk'] text-xs font-bold ${isSelected ? 'text-[#ffb4ab]' : 'text-slate-200'
                      }`}
                  >
                    {p.title}
                  </span>
                  <span
                    className={`material-symbols-outlined text-[18px] ${isSelected ? 'text-[#ff4444]' : 'text-slate-600'
                      }`}
                  >
                    {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                </div>
                <p className="font-sans text-[11px] text-slate-400 leading-relaxed">
                  {p.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* 토글 옵션 2종: 웨이크 워드 & Barge-In */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* 웨이크 워드 상시 감지 */}
          <div className="p-3.5 rounded-xl bg-[#0a0e18]/70 border border-white/[0.04] flex items-center justify-between">
            <div className="flex flex-col pr-3">
              <span className="font-['Space_Grotesk'] text-xs text-slate-200 font-semibold">
                웨이크 워드 상시 감지
              </span>
              <span className="font-sans text-[11px] text-slate-400 mt-0.5">
                &apos;자비스&apos; 또는 &apos;보스&apos; 호출 시 즉시 응답
              </span>
            </div>
            <button
              type="button"
              onClick={() => updateSetting('wakeWordEnabled', !settings.wakeWordEnabled)}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors relative cursor-pointer ${settings.wakeWordEnabled ? 'bg-[#dc2626]' : 'bg-[#262a35]'
                }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${settings.wakeWordEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>

          {/* 실시간 끊어듣기 (Barge-In) */}
          <div className="p-3.5 rounded-xl bg-[#0a0e18]/70 border border-white/[0.04] flex items-center justify-between">
            <div className="flex flex-col pr-3">
              <span className="font-['Space_Grotesk'] text-xs text-slate-200 font-semibold">
                실시간 끊어듣기 (Barge-In)
              </span>
              <span className="font-sans text-[11px] text-slate-400 mt-0.5">
                발화 도중 사용자 입력 발생 시 즉각 중단
              </span>
            </div>
            <button
              type="button"
              onClick={() => updateSetting('bargeInEnabled', !settings.bargeInEnabled)}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors relative cursor-pointer ${settings.bargeInEnabled ? 'bg-[#dc2626]' : 'bg-[#262a35]'
                }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${settings.bargeInEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 2. 지능형 코어 엔진 섹션 */}
      <section className="bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-white/[0.08] p-5 md:p-6 flex flex-col gap-5">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[#4cd7f6] text-[22px]">
            memory
          </span>
          <h2 className="font-['Space_Grotesk'] text-base font-semibold text-slate-100">
            지능형 코어 엔진 (LangChain Multi-Engine)
          </h2>
        </div>

        {/* 5대 모델 엔진 라디오 카드 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* 1. Google Gemini 3.1 Flash-Lite */}
          <button
            type="button"
            onClick={() => updateSetting('defaultModel', 'gemini-3.1-flash-lite')}
            className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
              settings.defaultModel === 'gemini-3.1-flash-lite'
                ? 'bg-[#1c1f2a] border-[#dc2626]/50 shadow-[0_0_16px_rgba(220,38,38,0.2)]'
                : 'bg-[#0a0e18]/80 hover:bg-[#171b26] border-white/[0.06]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-['Space_Grotesk'] text-xs font-bold text-slate-100">
                MK-85 Quantum (3.1 Flash-Lite)
              </span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#dc2626]/20 text-[#ffb4ab] border border-[#dc2626]/40">
                Google
              </span>
            </div>
            <p className="font-sans text-[11px] text-slate-400">
              초고속 응답, 정밀 인과 추론, 아키텍처 및 사내 RAG 문서 분석 최적화 모드
            </p>
          </button>

          {/* 2. Google Gemini 3.5 Flash-Lite */}
          <button
            type="button"
            onClick={() => updateSetting('defaultModel', 'gemini-3.5-flash-lite')}
            className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${settings.defaultModel === 'gemini-3.5-flash-lite'
                ? 'bg-[#1c1f2a] border-[#ffb95f]/50 shadow-[0_0_16px_rgba(255,185,95,0.2)]'
                : 'bg-[#0a0e18]/80 hover:bg-[#171b26] border-white/[0.06]'
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-['Space_Grotesk'] text-xs font-bold text-slate-100">
                Ultra-Lite (3.5 Lite)
              </span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#ffb95f]/20 text-[#ffb95f] border border-[#ffb95f]/40">
                Google
              </span>
            </div>
            <p className="font-sans text-[11px] text-slate-400">
              지연 시간 극소화, 일상 질의 응답, 빠른 단답형 브리핑 최적화 모드
            </p>
          </button>

          {/* 3. Cloudflare Llama 3.3 70B */}
          <button
            type="button"
            onClick={() => updateSetting('defaultModel', '@cf/meta/llama-3.3-70b-instruct-fp8-fast')}
            className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
              settings.defaultModel === '@cf/meta/llama-3.3-70b-instruct-fp8-fast' ||
              settings.defaultModel === '@cf/meta/llama-3.3-70b-instruct'
                ? 'bg-[#1c1f2a] border-[#f48120]/50 shadow-[0_0_16px_rgba(244,129,32,0.2)]'
                : 'bg-[#0a0e18]/80 hover:bg-[#171b26] border-white/[0.06]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-['Space_Grotesk'] text-xs font-bold text-slate-100">
                Llama 3.3 (70B)
              </span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#f48120]/20 text-[#f48120] border border-[#f48120]/40">
                Cloudflare
              </span>
            </div>
            <p className="font-sans text-[11px] text-slate-400">
              글로벌 엣지 인프라 기반 플래그십 오픈소스 대형 언어 모델
            </p>
          </button>

          {/* 4. Cloudflare Llama 3.1 8B */}
          <button
            type="button"
            onClick={() => updateSetting('defaultModel', '@cf/meta/llama-3.1-8b-instruct')}
            className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${settings.defaultModel === '@cf/meta/llama-3.1-8b-instruct'
                ? 'bg-[#1c1f2a] border-[#ea580c]/50 shadow-[0_0_16px_rgba(234,88,12,0.2)]'
                : 'bg-[#0a0e18]/80 hover:bg-[#171b26] border-white/[0.06]'
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-['Space_Grotesk'] text-xs font-bold text-slate-100">
                Llama 3.1 (8B)
              </span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#ea580c]/20 text-[#ff8c42] border border-[#ea580c]/40">
                Cloudflare
              </span>
            </div>
            <p className="font-sans text-[11px] text-slate-400">
              초저비용 초경량 엣지 아키텍처, 신속한 텔레메트리 연산에 최적화
            </p>
          </button>

          {/* 5. Cloudflare DeepSeek R1 */}
          <button
            type="button"
            onClick={() => updateSetting('defaultModel', '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b')}
            className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${settings.defaultModel === '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b'
                ? 'bg-[#1c1f2a] border-[#4cd7f6]/50 shadow-[0_0_16px_rgba(76,215,246,0.2)]'
                : 'bg-[#0a0e18]/80 hover:bg-[#171b26] border-white/[0.06]'
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-['Space_Grotesk'] text-xs font-bold text-slate-100">
                DeepSeek R1 (32B)
              </span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#4cd7f6]/20 text-[#4cd7f6] border border-[#4cd7f6]/40">
                Cloudflare
              </span>
            </div>
            <p className="font-sans text-[11px] text-slate-400">
              심층 다단계 추론(Reasoning) 및 고난도 수학/논리 분석 특화 모델
            </p>
          </button>
        </div>

        {/* 자율 조치 권한 단계 드롭다운 */}
        <div className="p-4 rounded-xl bg-[#0a0e18]/70 border border-white/[0.04] flex flex-col gap-2">
          <label
            htmlFor="autonomy-select"
            className="font-['Space_Grotesk'] text-xs text-slate-200 font-semibold"
          >
            자율 조치 권한 단계 (Autonomy Clearance)
          </label>
          <select
            id="autonomy-select"
            value={settings.autonomyLevel}
            onChange={(e) => updateSetting('autonomyLevel', Number(e.target.value))}
            className="w-full bg-[#121620] text-slate-200 text-xs py-2 px-3 rounded-lg border border-white/10 focus:outline-none focus:border-[#dc2626]/50"
          >
            <option value={1}>1단계: 단순 조언 (알림만 전송, 기기 제어 개입 없음)</option>
            <option value={2}>2단계: 사전 승인 (모든 조치 집행 전 사용자 승인 대기)</option>
            <option value={3}>3단계: 자동 격리 및 사후 보고 (비파괴적 대응 자동 처리 - 권장)</option>
            <option value={4}>4단계: 완전 위임 (모든 대응 권한 전면 위임)</option>
          </select>
        </div>
      </section>

      {/* 3. 보안 및 데이터 관리 섹션 */}
      <section className="bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-white/[0.08] p-5 md:p-6 flex flex-col gap-5">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[#ffb95f] text-[22px]">
            shield
          </span>
          <h2 className="font-['Space_Grotesk'] text-base font-semibold text-slate-100">
            보안 및 데이터 관리
          </h2>
        </div>

        {/* E2EE 종단간 암호화 토글 */}
        <div className="p-3.5 rounded-xl bg-[#0a0e18]/70 border border-white/[0.04] flex items-center justify-between">
          <div className="flex flex-col pr-3">
            <span className="font-['Space_Grotesk'] text-xs text-slate-200 font-semibold">
              대화 종단간 암호화 (E2EE)
            </span>
            <span className="font-mono text-[11px] text-slate-400 mt-0.5">
              AES-256-GCM 하드웨어 레벨 전송 및 로컬 격리 보관
            </span>
          </div>
          <button
            type="button"
            onClick={() => updateSetting('e2eeEnabled', !settings.e2eeEnabled)}
            className={`w-11 h-6 rounded-full p-0.5 transition-colors relative cursor-pointer ${settings.e2eeEnabled ? 'bg-[#dc2626]' : 'bg-[#262a35]'
              }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${settings.e2eeEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
            />
          </button>
        </div>

        {/* 데이터 초기화 버튼 */}
        <div className="pt-1">
          <button
            type="button"
            onClick={resetAllData}
            className="w-full py-2.5 px-4 rounded-xl bg-[#1c1f2a] hover:bg-[#93000a]/40 text-[#ffb4ab] border border-red-500/20 text-xs font-['Space_Grotesk'] font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
            <span>로컬 캐시 및 설정 완전 초기화</span>
          </button>
        </div>
      </section>
    </div>
  );
};
