import { Attempt, AttemptAnswer, Question } from '../models/models';

/** Lower-cases, trims, collapses spaces and drops trailing punctuation so "Paris." matches "paris". */
export function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?,;:]+$/, '');
}

/** Marks one answer. Essays return isCorrect = null until someone grades them. */
export function gradeAnswer(question: Question, answer: string[]): AttemptAnswer {
  const given = answer.map((a) => a.trim()).filter(Boolean);
  let isCorrect: boolean | null;
  switch (question.type) {
    case 'multiple-choice':
    case 'true-false': {
      const expected = new Set(question.correctAnswers);
      isCorrect = given.length === expected.size && given.every((a) => expected.has(a));
      break;
    }
    case 'short-answer': {
      const accepted = question.correctAnswers.map(normalizeAnswer);
      isCorrect = given.length > 0 && accepted.includes(normalizeAnswer(given[0]));
      break;
    }
    case 'essay':
      isCorrect = given.length ? null : false;
      break;
  }
  return { questionId: question.id, answer: given, isCorrect, score: isCorrect ? question.score : 0 };
}

export function isPending(answers: AttemptAnswer[]): boolean {
  return answers.some((a) => a.isCorrect === null);
}

export function totalScore(answers: AttemptAnswer[]): number {
  return answers.reduce((sum, a) => sum + a.score, 0);
}

export function percent(attempt: Pick<Attempt, 'totalScore' | 'maxScore'>): number {
  return attempt.maxScore ? Math.round((attempt.totalScore / attempt.maxScore) * 100) : 0;
}

/** A friendly label for a result. */
export function resultMood(pct: number): { icon: string; text: string } {
  if (pct >= 90) return { icon: 'workspace_premium', text: 'Outstanding!' };
  if (pct >= 75) return { icon: 'auto_awesome', text: 'Great work!' };
  if (pct >= 50) return { icon: 'thumb_up', text: 'Good effort!' };
  return { icon: 'fitness_center', text: 'Keep practising!' };
}
