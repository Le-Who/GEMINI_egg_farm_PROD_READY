/**
 * {{GAME_TITLE}} — Trivia Types
 */

import type { BasePlayerState, ContentItem } from "@discord-activities/core";

export interface TriviaPlayerState extends BasePlayerState {
  score: number;
  totalCorrect: number;
  totalQuestions: number;
  streak: number;
  bestStreak: number;
  currentSession: TriviaSession | null;
}

export interface TriviaSession {
  questions: TriviaQuestion[];
  currentIndex: number;
  answers: PlayerAnswer[];
  startedAt: number;
  timePerQuestion: number;
  isComplete: boolean;
  finalScore: number;
}

export interface TriviaQuestion extends ContentItem {
  category: string;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  correctAnswer: string;
  wrongAnswers: string[];
  timeLimit: number;
  points: number;
}

export interface PlayerAnswer {
  questionIndex: number;
  answer: string;
  correct: boolean;
  timeMs: number;
  points: number;
}
