import { Attempt, AttemptAnswer, Exam, FamilyMember, Question } from '../../core/models/models';

/** Reading and writing Excel sheets for paper exam results. */

const loadXlsx = () => import('xlsx');
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface ResultRow {
  rowNumber: number;
  member?: FamilyMember;
  memberText: string;
  date: Date | null;
  total: number;
  maxScore: number;
  /** Present when the sheet gave points per question. */
  answers: AttemptAnswer[];
  errors: string[];
}

const questionHeader = (i: number, q: Question) => `Q${i + 1} (${q.score} pts)`;

export async function downloadResultsTemplate(exam: Exam, questions: Question[], family: FamilyMember[]) {
  const XLSX = await loadXlsx();
  const today = new Date().toISOString().slice(0, 10);
  const header = ['Member', 'Date', 'Total score', ...questions.map((q, i) => questionHeader(i, q))];
  const example = [family[0]?.name ?? '', today, '', ...questions.map(() => '')];
  const sheet = XLSX.utils.aoa_to_sheet([header, example]);
  sheet['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 12 }, ...questions.map(() => ({ wch: 12 }))];

  const max = questions.reduce((s, q) => s + q.score, 0);
  const help = XLSX.utils.aoa_to_sheet([
    [`Paper results for: ${exam.title}`],
    [],
    ['Member', `Name or email: ${family.map((m) => m.name).join(', ')}`],
    ['Date', 'The day of the exam, e.g. ' + today],
    ['Total score', `Points out of ${max}. Leave empty if you fill in the question columns.`],
    ['Q1, Q2, …', 'Optional: points earned for each question. Gives better reports.'],
    [],
    ['Question', 'Points', 'Text'],
    ...questions.map((q, i) => [`Q${i + 1}`, q.score, q.text]),
  ]);
  help['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 80 }];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Results');
  XLSX.utils.book_append_sheet(book, help, 'Help');
  XLSX.writeFile(book, `${exam.title.replace(/[^\w -]/g, '')} - results.xlsx`);
}

export async function readResultsFile(file: File, questions: Question[], family: FamilyMember[]): Promise<ResultRow[]> {
  const XLSX = await loadXlsx();
  const book = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const sheet = book.Sheets[book.SheetNames.find((n) => key(n) === 'results') ?? book.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });

  const headerIndex = grid.slice(0, 10).findIndex((r) => r.some((c) => ['member', 'name', 'student'].includes(key(String(c)))));
  if (headerIndex < 0) throw new Error('Could not find a "Member" column. Download the template to see the layout.');
  const rawHeaders = grid[headerIndex].map((c) => String(c));
  const headers = rawHeaders.map(key);
  const col = (...names: string[]) => headers.findIndex((h) => names.includes(h));
  const memberCol = col('member', 'name', 'student');
  const dateCol = col('date', 'day', 'examdate');
  const totalCol = col('totalscore', 'total', 'score', 'points');
  // Question columns start with "Q<number>", e.g. "Q1 (2 pts)" or "q 1".
  const questionNumber = (h: string) => Number(h.match(/^\s*q\s*(\d+)\b/i)?.[1] ?? 0);
  const questionCols = questions.map((_, i) => rawHeaders.findIndex((h) => questionNumber(h) === i + 1));
  const maxScore = questions.reduce((s, q) => s + q.score, 0);

  const rows: ResultRow[] = [];
  for (let r = headerIndex + 1; r < grid.length; r++) {
    const cells = grid[r];
    if (cells.every((c) => String(c ?? '').trim() === '')) continue;
    const errors: string[] = [];

    const memberText = String(cells[memberCol] ?? '').trim();
    const member = family.find((m) => key(m.name) === key(memberText) || m.email.toLowerCase() === memberText.toLowerCase());
    if (!member) errors.push(memberText ? `Unknown member "${memberText}".` : 'Member is empty.');

    const date = dateCol >= 0 ? toDate(cells[dateCol]) : null;
    if (!date) errors.push('Date is missing or not a date.');

    const answers: AttemptAnswer[] = [];
    questions.forEach((q, i) => {
      const raw = questionCols[i] >= 0 ? String(cells[questionCols[i]] ?? '').trim() : '';
      if (!raw) return;
      const score = Number(raw);
      if (!Number.isFinite(score) || score < 0 || score > q.score) {
        errors.push(`Q${i + 1} must be a number from 0 to ${q.score}.`);
        return;
      }
      answers.push({ questionId: q.id, answer: [], isCorrect: score >= q.score, score });
    });

    let total: number;
    const totalText = totalCol >= 0 ? String(cells[totalCol] ?? '').trim() : '';
    if (answers.length) {
      total = answers.reduce((s, a) => s + a.score, 0);
      if (answers.length < questions.length) errors.push(`Only ${answers.length} of ${questions.length} questions have points.`);
    } else {
      total = Number(totalText);
      if (!totalText || !Number.isFinite(total)) errors.push('Fill in the total score or the question columns.');
      else if (total < 0 || total > maxScore) errors.push(`Total must be from 0 to ${maxScore}.`);
    }

    rows.push({ rowNumber: r + 1, member, memberText, date, total, maxScore, answers, errors });
  }
  return rows;
}

export function toAttempt(row: ResultRow, examId: string): Omit<Attempt, 'id'> {
  const time = row.date!.getTime();
  return {
    examId,
    takenBy: row.member!.email,
    answers: row.answers,
    totalScore: row.total,
    maxScore: row.maxScore,
    gradingStatus: 'graded',
    source: 'manual',
    startedAt: time,
    submittedAt: time,
  };
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const text = String(value ?? '').trim();
  if (!text) return null;
  // Midday local time, so the day never shifts across time zones.
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12);
  // Day-first for slash dates, e.g. 27/09/2026.
  const dmy = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/);
  if (dmy) {
    const year = Number(dmy[3]) < 100 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    const d = new Date(year, Number(dmy[2]) - 1, Number(dmy[1]), 12);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(text);
  return isNaN(d.getTime()) ? null : d;
}
