/** Timestamps are stored as epoch milliseconds so they sort and chart easily. */
export type Millis = number;

export interface FamilyMember {
  name: string;
  email: string;
}

export interface Subject {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number;
  subjects: Subject[];
}

export type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer' | 'essay';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
  id: string;
  categoryId: string;
  subjectId: string;
  type: QuestionType;
  text: string;
  /** Choices for multiple-choice; ['True', 'False'] for true-false; empty otherwise. */
  options: string[];
  /** One or more correct answers. Short answer accepts any listed value; essay holds a model answer. */
  correctAnswers: string[];
  score: number;
  difficulty: Difficulty;
  tags: string[];
  createdBy: string;
  createdAt: Millis;
}

/**
 * What the question form and the Excel upload produce. The subject is a name, not an id,
 * so a new subject can be typed in and is created when the question is saved.
 */
export interface QuestionDraft {
  categoryId: string;
  subjectName: string;
  type: QuestionType;
  text: string;
  options: string[];
  correctAnswers: string[];
  score: number;
  difficulty: Difficulty;
  tags: string[];
}

export interface Exam {
  id: string;
  title: string;
  categoryId: string;
  /** Empty string = questions from any subject in the category. */
  subjectId: string;
  questionIds: string[];
  /** null = no time limit. */
  durationMin: number | null;
  createdBy: string;
  createdAt: Millis;
}

export interface AttemptAnswer {
  questionId: string;
  answer: string[];
  /** null while an essay answer waits to be graded. */
  isCorrect: boolean | null;
  score: number;
  feedback?: string;
}

export interface Attempt {
  id: string;
  examId: string;
  takenBy: string;
  answers: AttemptAnswer[];
  totalScore: number;
  maxScore: number;
  gradingStatus: 'pending' | 'graded';
  source: 'online' | 'manual';
  startedAt: Millis;
  submittedAt: Millis;
}

export type ExamDraft = Omit<Exam, 'id' | 'createdBy' | 'createdAt'>;
