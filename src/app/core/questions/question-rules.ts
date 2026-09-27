import { Category, Difficulty, Question, QuestionDraft, QuestionType } from '../models/models';

export const QUESTION_TYPES: { value: QuestionType; label: string; icon: string }[] = [
  { value: 'multiple-choice', label: 'Multiple choice', icon: 'checklist' },
  { value: 'true-false', label: 'True / False', icon: 'rule' },
  { value: 'short-answer', label: 'Short answer', icon: 'short_text' },
  { value: 'essay', label: 'Essay', icon: 'notes' },
];

export const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export const TRUE_FALSE = ['True', 'False'];
export const MAX_OPTIONS = 6;
export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function typeInfo(type: QuestionType) {
  return QUESTION_TYPES.find((t) => t.value === type)!;
}

export function emptyDraft(keep?: Partial<QuestionDraft>): QuestionDraft {
  return withTypeDefaults({
    categoryId: keep?.categoryId ?? '',
    subjectName: keep?.subjectName ?? '',
    type: keep?.type ?? 'multiple-choice',
    text: '',
    options: [],
    correctAnswers: [],
    score: keep?.score ?? 1,
    difficulty: keep?.difficulty ?? 'medium',
    tags: [],
  });
}

/** Gives the options/answers the shape each question type expects. */
export function withTypeDefaults(draft: QuestionDraft): QuestionDraft {
  switch (draft.type) {
    case 'multiple-choice': {
      const options = draft.options.length >= 2 ? draft.options : ['', '', '', ''];
      return { ...draft, options, correctAnswers: draft.correctAnswers.filter((a) => options.includes(a)) };
    }
    case 'true-false':
      return {
        ...draft,
        options: [...TRUE_FALSE],
        correctAnswers: draft.correctAnswers.filter((a) => TRUE_FALSE.includes(a)).slice(0, 1),
      };
    default:
      return { ...draft, options: [] };
  }
}

/** Trims text and drops empty options/answers. */
export function normalizeDraft(draft: QuestionDraft): QuestionDraft {
  const trimAll = (list: string[]) => list.map((s) => s.trim()).filter(Boolean);
  return {
    ...draft,
    subjectName: draft.subjectName.trim(),
    text: draft.text.trim(),
    options: draft.type === 'true-false' ? [...TRUE_FALSE] : trimAll(draft.options),
    correctAnswers: trimAll(draft.correctAnswers),
    tags: trimAll(draft.tags),
    score: Number(draft.score),
  };
}

/** Returns a list of problems; an empty list means the question can be saved. */
export function validateDraft(draft: QuestionDraft, categoryById: Map<string, Category>): string[] {
  const d = normalizeDraft(draft);
  const errors: string[] = [];
  if (!categoryById.has(d.categoryId)) errors.push('Choose a category.');
  if (!d.subjectName) errors.push('Choose or type a subject.');
  if (!d.text) errors.push('Write the question.');
  if (!(d.score > 0)) errors.push('Score must be more than 0.');

  switch (d.type) {
    case 'multiple-choice':
      if (d.options.length < 2) errors.push('Add at least 2 options.');
      if (new Set(d.options.map((o) => o.toLowerCase())).size !== d.options.length)
        errors.push('Two options are the same.');
      if (d.correctAnswers.length === 0) errors.push('Mark at least one correct option.');
      else if (d.correctAnswers.some((a) => !d.options.includes(a)))
        errors.push('The correct answer must be one of the options.');
      break;
    case 'true-false':
      if (d.correctAnswers.length !== 1) errors.push('Choose True or False as the correct answer.');
      break;
    case 'short-answer':
      if (d.correctAnswers.length === 0) errors.push('Add at least one accepted answer.');
      break;
  }
  return errors;
}

export function questionToDraft(q: Question, categoryById: Map<string, Category>): QuestionDraft {
  const subject = categoryById.get(q.categoryId)?.subjects.find((s) => s.id === q.subjectId);
  return {
    categoryId: q.categoryId,
    subjectName: subject?.name ?? '',
    type: q.type,
    text: q.text,
    options: [...q.options],
    correctAnswers: [...q.correctAnswers],
    score: q.score,
    difficulty: q.difficulty,
    tags: [...q.tags],
  };
}

export function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
