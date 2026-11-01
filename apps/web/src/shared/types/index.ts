/**
 * 자비서 (jarvisor) 공통 도메인 타입 정의
 */

export type ModelType =
  | 'gemini-3.1-flash-lite'
  | 'gemini-3.5-flash-lite'
  | '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
  | '@cf/meta/llama-3.3-70b-instruct'
  | '@cf/meta/llama-3.1-8b-instruct'
  | '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b'
  | 'gemini-3.8-flash';

export type PersonaType = 'classic' | 'brief' | 'tactical';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  model?: ModelType;
  errorInfo?: {
    message: string;
    isOverloaded?: boolean;
  };
}

export interface SessionData {
  id: string;
  title: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  model: ModelType;
  isPinned: boolean;
  isArchived: boolean;
}
