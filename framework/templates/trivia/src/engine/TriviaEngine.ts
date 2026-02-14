/**
 * {{GAME_TITLE}} — Trivia Engine
 *
 * Handles question selection, answer validation, scoring, and streaks.
 */

import type {
  TriviaPlayerState,
  TriviaSession,
  TriviaQuestion,
  PlayerAnswer,
} from "../types";

export class TriviaEngine {
  private questions: TriviaQuestion[] = [];

  loadQuestions(questions: TriviaQuestion[]): void {
    this.questions = questions;
  }

  createDefaultState(id: string, username: string): TriviaPlayerState {
    return {
      id,
      username,
      score: 0,
      totalCorrect: 0,
      totalQuestions: 0,
      streak: 0,
      bestStreak: 0,
      currentSession: null,
    };
  }

  /** Start a new trivia session */
  startSession(count: number = 10, difficulty?: string): TriviaSession {
    let pool = [...this.questions];
    if (difficulty) {
      pool = pool.filter((q) => q.difficulty === difficulty);
    }

    // Shuffle and pick
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));

    return {
      questions: selected,
      currentIndex: 0,
      answers: [],
      startedAt: Date.now(),
      timePerQuestion: 15000,
      isComplete: false,
      finalScore: 0,
    };
  }

  /** Answer the current question */
  answerQuestion(
    session: TriviaSession,
    answer: string,
    timeMs: number,
  ): { session: TriviaSession; correct: boolean; points: number } {
    const question = session.questions[session.currentIndex];
    if (!question || session.isComplete) {
      return { session, correct: false, points: 0 };
    }

    const correct = answer === question.correctAnswer;
    const timeBonus = correct
      ? Math.max(0, Math.floor((question.timeLimit * 1000 - timeMs) / 100))
      : 0;
    const points = correct ? question.points + timeBonus : 0;

    const playerAnswer: PlayerAnswer = {
      questionIndex: session.currentIndex,
      answer,
      correct,
      timeMs,
      points,
    };

    session.answers.push(playerAnswer);
    session.currentIndex++;
    session.finalScore += points;

    if (session.currentIndex >= session.questions.length) {
      session.isComplete = true;
    }

    return { session, correct, points };
  }

  /** Get the current question with shuffled answers */
  getCurrentQuestion(session: TriviaSession): {
    question: string;
    answers: string[];
    category: string;
    difficulty: string;
    index: number;
    total: number;
  } | null {
    const q = session.questions[session.currentIndex];
    if (!q || session.isComplete) return null;

    const answers = [q.correctAnswer, ...q.wrongAnswers].sort(
      () => Math.random() - 0.5,
    );

    return {
      question: q.question,
      answers,
      category: q.category,
      difficulty: q.difficulty,
      index: session.currentIndex,
      total: session.questions.length,
    };
  }

  /** Update player state after a session */
  applySessionResults(
    state: TriviaPlayerState,
    session: TriviaSession,
  ): TriviaPlayerState {
    const correctCount = session.answers.filter((a) => a.correct).length;

    return {
      ...state,
      score: state.score + session.finalScore,
      totalCorrect: state.totalCorrect + correctCount,
      totalQuestions: state.totalQuestions + session.answers.length,
      streak: correctCount === session.questions.length ? state.streak + 1 : 0,
      bestStreak: Math.max(
        state.bestStreak,
        correctCount === session.questions.length
          ? state.streak + 1
          : state.streak,
      ),
      currentSession: null,
    };
  }
}
