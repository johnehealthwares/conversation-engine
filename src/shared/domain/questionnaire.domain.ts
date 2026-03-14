import type { Question } from './question.domain';

export type Questionnaire = {
  id: string;

  // Basic info
  name: string;
  code: string; // unique identifier (useful for system initiated flows)
  description?: string;

  introduction?: string;
  conclusion?: string;
  // Behavior
  isDynamic: boolean; // true = AI driven, false = static flow
  version: number;

  // Flow control
  startQuestionId?: string;
  endPhrase: string;
  allowBackNavigation: boolean;
  allowMultipleSessions: boolean;

  // Execution mode
  processingStrategy: 'STATIC' | 'AI_ASSISTED' | 'FULL_AI';

  // Optional question tree (if preloaded)
  questions?: Question[];

  // Metadata
  tags?: string[];
  metadata?: Record<string, any>;

  // State
  isActive: boolean;

  // Audit
  createdAt: Date;
  updatedAt: Date;
};