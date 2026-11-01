'use client';

import { useState } from 'react';
import { ModelType, PersonaType } from '@/shared/types';

export interface SystemSettings {
  persona: PersonaType;
  wakeWordEnabled: boolean;
  bargeInEnabled: boolean;
  defaultModel: ModelType;
  autonomyLevel: number;
  e2eeEnabled: boolean;
}

const DEFAULT_SETTINGS: SystemSettings = {
  persona: 'classic',
  wakeWordEnabled: true,
  bargeInEnabled: true,
  defaultModel: 'gemini-3.1-flash-lite',
  autonomyLevel: 3,
  e2eeEnabled: true,
};

const STORAGE_KEY = 'jarvisor_system_settings_v1';
const LEGACY_STORAGE_KEY = 'javisor_system_settings_v1';

/**
 * 시스템 설정 영속화 및 환경 제어 훅 (Lazy State Initialization 패턴)
 */
export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // 로컬스토리지 접근 불가 시 기본값 반환
    }
    return DEFAULT_SETTINGS;
  });

  const [isSaved, setIsSaved] = useState(false);

  const updateSetting = <K extends keyof SystemSettings>(
    key: K,
    value: SystemSettings[K]
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 오류 무시
      }
      return next;
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const resetAllData = () => {
    if (confirm('모든 로컬 대화 기록 및 캐시를 초기화하시겠습니까?')) {
      try {
        localStorage.clear();
      } catch {
        // 오류 무시
      }
      setSettings(DEFAULT_SETTINGS);
      window.location.reload();
    }
  };

  return {
    settings,
    updateSetting,
    isSaved,
    resetAllData,
  };
}
