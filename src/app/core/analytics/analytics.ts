import { Attempt, Exam, Question } from '../models/models';

/** Pure functions that turn stored data into the numbers the dashboards show. */

export interface Range {
  start: number;
  end: number;
}

const DAY = 86_400_000;
/** Resumed attempts can span days; longer than this is not counted as study time. */
const MAX_ATTEMPT_MS = 3 * 60 * 60_000;

export function dayRange(date: Date): Range {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

/** The `count` days ending with `date`, oldest first. */
export function daysEnding(date: Date, count: number): (Range & { date: Date })[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(date);
    d.setDate(d.getDate() - (count - 1 - i));
    return { ...dayRange(d), date: d };
  });
}

export function lastDays(days: number | null): Range {
  const end = dayRange(new Date()).end;
  return { start: days === null ? 0 : end - days * DAY, end };
}

const inRange = (t: number, r: Range) => t >= r.start && t < r.end;
const byMember = (email: string, who: string) => !email || who.toLowerCase() === email.toLowerCase();

export function questionsCreated(questions: Question[], range: Range, email: string): Question[] {
  return questions.filter((q) => inRange(q.createdAt, range) && byMember(email, q.createdBy));
}

export function attemptsIn(attempts: Attempt[], range: Range, email: string): Attempt[] {
  return attempts.filter((a) => inRange(a.submittedAt, range) && byMember(email, a.takenBy));
}

export function answerTally(attempts: Attempt[]) {
  const answers = attempts.flatMap((a) => a.answers);
  return {
    right: answers.filter((a) => a.isCorrect === true).length,
    wrong: answers.filter((a) => a.isCorrect === false).length,
    pending: answers.filter((a) => a.isCorrect === null).length,
  };
}

export function timeSpentMs(attempts: Attempt[]): number {
  return attempts
    .filter((a) => a.source === 'online')
    .reduce((sum, a) => sum + Math.min(MAX_ATTEMPT_MS, Math.max(0, a.submittedAt - a.startedAt)), 0);
}

export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function averagePct(attempts: Attempt[]): number | null {
  const scored = attempts.filter((a) => a.maxScore > 0);
  if (!scored.length) return null;
  return Math.round(scored.reduce((s, a) => s + (a.totalScore / a.maxScore) * 100, 0) / scored.length);
}

export interface ScoreGroup {
  id: string;
  earned: number;
  possible: number;
  /** Number of marked answers (or paper exams without per-question marks). */
  count: number;
  pct: number;
}

/**
 * Points earned vs possible, grouped by `groupOf(question)`. Answers still waiting
 * for marks are skipped. Paper results without per-question marks count toward the
 * exam's category (they have no subject information).
 */
export function scoreBy(
  attempts: Attempt[],
  questionById: Map<string, Question>,
  examById: Map<string, Exam>,
  groupOf: (q: Question) => string,
  groupOfExam?: (e: Exam) => string,
): ScoreGroup[] {
  const groups = new Map<string, ScoreGroup>();
  const add = (id: string, earned: number, possible: number) => {
    const g = groups.get(id) ?? { id, earned: 0, possible: 0, count: 0, pct: 0 };
    g.earned += earned;
    g.possible += possible;
    g.count += 1;
    groups.set(id, g);
  };
  for (const attempt of attempts) {
    if (!attempt.answers.length) {
      const exam = examById.get(attempt.examId);
      if (exam && groupOfExam) add(groupOfExam(exam), attempt.totalScore, attempt.maxScore);
      continue;
    }
    for (const answer of attempt.answers) {
      const q = questionById.get(answer.questionId);
      if (!q || answer.isCorrect === null) continue;
      add(groupOf(q), answer.score, q.score);
    }
  }
  return [...groups.values()].map((g) => ({ ...g, pct: g.possible ? Math.round((g.earned / g.possible) * 100) : 0 }));
}

export interface QuestionStat {
  question: Question;
  answered: number;
  correct: number;
  pct: number | null;
}

/** How each question in an exam went across its attempts. */
export function questionStats(exam: Exam, attempts: Attempt[], questionById: Map<string, Question>): QuestionStat[] {
  return exam.questionIds
    .map((id) => questionById.get(id))
    .filter((q): q is Question => !!q)
    .map((question) => {
      const answers = attempts
        .flatMap((a) => a.answers)
        .filter((a) => a.questionId === question.id && a.isCorrect !== null);
      const earned = answers.reduce((s, a) => s + a.score, 0);
      return {
        question,
        answered: answers.length,
        correct: answers.filter((a) => a.isCorrect).length,
        pct: answers.length ? Math.round((earned / (answers.length * question.score)) * 100) : null,
      };
    });
}

