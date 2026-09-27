import { Category, Difficulty, QuestionDraft, QuestionType } from '../../core/models/models';
import { OPTION_LETTERS, TRUE_FALSE, withTypeDefaults } from '../../core/questions/question-rules';

/** SheetJS is large, so it is only downloaded when the Upload page needs it. */
const loadXlsx = () => import('xlsx');

type Column =
  | 'category' | 'subject' | 'type' | 'question'
  | 'a' | 'b' | 'c' | 'd' | 'e' | 'f'
  | 'answer' | 'score' | 'difficulty' | 'tags';

const TEMPLATE_HEADERS: [Column, string][] = [
  ['category', 'Category'],
  ['subject', 'Subject'],
  ['type', 'Type'],
  ['question', 'Question'],
  ['a', 'Option A'],
  ['b', 'Option B'],
  ['c', 'Option C'],
  ['d', 'Option D'],
  ['e', 'Option E'],
  ['f', 'Option F'],
  ['answer', 'Correct Answer'],
  ['score', 'Score'],
  ['difficulty', 'Difficulty'],
  ['tags', 'Tags'],
];

/** Accepted header spellings, compared after lower-casing and removing spaces/punctuation. */
const HEADER_ALIASES: Record<Column, string[]> = {
  category: ['category', 'cat', 'course'],
  subject: ['subject', 'topic', 'unit', 'lesson'],
  type: ['type', 'questiontype', 'kind'],
  question: ['question', 'questiontext', 'text', 'q'],
  a: ['optiona', 'a', 'choicea', 'option1'],
  b: ['optionb', 'b', 'choiceb', 'option2'],
  c: ['optionc', 'c', 'choicec', 'option3'],
  d: ['optiond', 'd', 'choiced', 'option4'],
  e: ['optione', 'e', 'choicee', 'option5'],
  f: ['optionf', 'f', 'choicef', 'option6'],
  answer: ['correctanswer', 'answer', 'answers', 'correct', 'correctanswers', 'key'],
  score: ['score', 'points', 'point', 'mark', 'marks'],
  difficulty: ['difficulty', 'level'],
  tags: ['tags', 'tag', 'keywords'],
};

const TYPE_ALIASES: Record<string, QuestionType> = {
  multiplechoice: 'multiple-choice', mc: 'multiple-choice', mcq: 'multiple-choice', choice: 'multiple-choice',
  truefalse: 'true-false', tf: 'true-false', yesno: 'true-false', boolean: 'true-false',
  shortanswer: 'short-answer', short: 'short-answer', sa: 'short-answer', fillin: 'short-answer', fillintheblank: 'short-answer',
  essay: 'essay', long: 'essay', longanswer: 'essay', descriptive: 'essay', open: 'essay',
};

const DIFFICULTY_ALIASES: Record<string, Difficulty> = {
  easy: 'easy', '1': 'easy', low: 'easy',
  medium: 'medium', '2': 'medium', normal: 'medium', mid: 'medium',
  hard: 'hard', '3': 'hard', high: 'hard', difficult: 'hard',
};

const OPTION_COLUMNS: Column[] = ['a', 'b', 'c', 'd', 'e', 'f'];

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface ParsedRow {
  rowNumber: number;
  draft: QuestionDraft;
  /** Category as written in the file, for error messages when it doesn't match. */
  categoryText: string;
  /** Problems found while reading the cell values (validation errors come later). */
  parseErrors: string[];
}

export interface Defaults {
  categoryId: string;
  subjectName: string;
}

export async function downloadTemplate(categories: Category[]) {
  const XLSX = await loadXlsx();
  const [first, second] = [categories[0], categories[1] ?? categories[0]];
  const examples: string[][] = [
    [first?.name ?? 'English', 'Grammar', 'Multiple choice', 'Which word is a noun?', 'run', 'happy', 'table', 'quickly', '', '', 'C', '1', 'Easy', 'nouns'],
    [second?.name ?? 'Geography', 'Rivers', 'True/False', 'The Nile is the longest river in Africa.', '', '', '', '', '', '', 'True', '1', 'Medium', ''],
    [first?.name ?? 'English', 'Spelling', 'Short answer', 'Spell the plural of "child".', '', '', '', '', '', '', 'children', '2', 'Easy', ''],
    [second?.name ?? 'Geography', 'Climate', 'Essay', 'Explain why deserts are dry.', '', '', '', '', '', '', 'Little rain because…', '5', 'Hard', ''],
  ];
  const questions = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS.map(([, label]) => label), ...examples]);
  questions['!cols'] = [14, 14, 16, 48, 14, 14, 14, 14, 14, 14, 18, 8, 10, 16].map((wch) => ({ wch }));
  questions['!freeze'] = { xSplit: 0, ySplit: 1 };

  const help = XLSX.utils.aoa_to_sheet([
    ['How to fill in the Questions sheet'],
    [],
    ['Column', 'What to write'],
    ['Category', 'One of the category names below (must already exist).'],
    ['Subject', 'Any subject name. New subjects are created automatically.'],
    ['Type', 'Multiple choice, True/False, Short answer or Essay. Leave empty to let the app guess.'],
    ['Question', 'The question text (required).'],
    ['Option A–F', 'Only for multiple choice. At least 2 options.'],
    ['Correct Answer', 'Multiple choice: the letter(s), e.g. C or A,C.  True/False: True or False.'],
    ['', 'Short answer: the answer; separate other accepted answers with ;  e.g. color;colour'],
    ['', 'Essay: optional model answer.'],
    ['Score', 'Points for the question. Empty = 1.'],
    ['Difficulty', 'Easy, Medium or Hard. Empty = Medium.'],
    ['Tags', 'Optional, separated by commas.'],
    [],
    ['Delete the example rows before uploading. Extra columns are ignored.'],
    [],
    ['Your categories', 'Existing subjects'],
    ...categories.map((c) => [c.name, c.subjects.map((s) => s.name).join(', ')]),
  ]);
  help['!cols'] = [{ wch: 18 }, { wch: 90 }];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, questions, 'Questions');
  XLSX.utils.book_append_sheet(book, help, 'Help');
  XLSX.writeFile(book, 'questions-template.xlsx');
}

export async function readQuestionFile(file: File, categories: Category[], defaults: Defaults): Promise<ParsedRow[]> {
  const XLSX = await loadXlsx();
  const book = XLSX.read(await file.arrayBuffer());
  const sheetName = book.SheetNames.find((n) => key(n) === 'questions') ?? book.SheetNames[0];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName], { header: 1, defval: '', raw: false });

  const headerIndex = grid.slice(0, 10).findIndex((row) => row.some((cell) => HEADER_ALIASES.question.includes(key(String(cell)))));
  if (headerIndex < 0) {
    throw new Error('Could not find a header row with a "Question" column. Download the template to see the expected layout.');
  }

  const columns = mapHeaders(grid[headerIndex].map(String));
  const rows: ParsedRow[] = [];
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const cells = grid[i].map((c) => String(c ?? '').trim());
    if (cells.every((c) => !c)) continue;
    const get = (col: Column) => (columns.has(col) ? cells[columns.get(col)!] ?? '' : '');
    rows.push(toRow(i + 1, get, categories, defaults));
  }
  return rows;
}

function mapHeaders(headers: string[]): Map<Column, number> {
  const map = new Map<Column, number>();
  headers.forEach((header, index) => {
    const k = key(header);
    for (const [column, aliases] of Object.entries(HEADER_ALIASES) as [Column, string[]][]) {
      if (!map.has(column) && aliases.includes(k)) map.set(column, index);
    }
  });
  return map;
}

function toRow(rowNumber: number, get: (c: Column) => string, categories: Category[], defaults: Defaults): ParsedRow {
  const parseErrors: string[] = [];
  const categoryText = get('category');
  const category = categoryText
    ? categories.find((c) => key(c.name) === key(categoryText) || c.id === categoryText)
    : categories.find((c) => c.id === defaults.categoryId);

  const options = OPTION_COLUMNS.map(get).filter(Boolean);
  const answerText = get('answer');
  const typeText = get('type');
  let type = TYPE_ALIASES[key(typeText)];
  if (typeText && !type) parseErrors.push(`Unknown type "${typeText}".`);
  type ??= guessType(options, answerText);

  let correctAnswers: string[];
  if (type === 'multiple-choice') {
    correctAnswers = answerText.split(/[,;|]/).map((token) => resolveOption(token.trim(), options)).filter(Boolean);
    for (const answer of correctAnswers.filter((a) => !options.includes(a))) {
      parseErrors.push(`Answer "${answer}" doesn't match any option.`);
    }
  } else if (type === 'true-false') {
    const tf = toTrueFalse(answerText);
    correctAnswers = tf ? [tf] : [];
    if (answerText && !tf) parseErrors.push(`"${answerText}" is not True or False.`);
  } else if (type === 'short-answer') {
    correctAnswers = answerText.split(/[;|]/);
  } else {
    correctAnswers = answerText ? [answerText] : [];
  }

  const difficultyText = get('difficulty');
  const difficulty = DIFFICULTY_ALIASES[key(difficultyText)];
  if (difficultyText && !difficulty) parseErrors.push(`Unknown difficulty "${difficultyText}".`);

  const scoreText = get('score');
  const draft = withTypeDefaults({
    categoryId: category?.id ?? '',
    subjectName: get('subject') || defaults.subjectName,
    type,
    text: get('question'),
    options,
    correctAnswers: correctAnswers.map((a) => a.trim()).filter(Boolean),
    score: scoreText ? Number(scoreText) : 1,
    difficulty: difficulty ?? 'medium',
    tags: get('tags').split(',').map((t) => t.trim()).filter(Boolean),
  });
  return { rowNumber, draft, categoryText, parseErrors };
}

function guessType(options: string[], answer: string): QuestionType {
  if (options.length >= 2) return 'multiple-choice';
  if (toTrueFalse(answer)) return 'true-false';
  return answer.length > 80 || !answer ? 'essay' : 'short-answer';
}

/** Turns "C", "c", "3" or the option text itself into the option text. */
function resolveOption(token: string, options: string[]): string {
  if (!token) return '';
  const letter = OPTION_LETTERS.indexOf(token.toUpperCase());
  if (letter >= 0 && letter < options.length) return options[letter];
  const number = Number(token);
  if (Number.isInteger(number) && number >= 1 && number <= options.length) return options[number - 1];
  return options.find((o) => o.toLowerCase() === token.toLowerCase()) ?? token;
}

function toTrueFalse(value: string): string | null {
  const k = key(value);
  if (['true', 't', 'yes', 'y', '1', 'correct'].includes(k)) return TRUE_FALSE[0];
  if (['false', 'f', 'no', 'n', '0', 'incorrect', 'wrong'].includes(k)) return TRUE_FALSE[1];
  return null;
}
