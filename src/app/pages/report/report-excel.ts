import { Attempt, Exam, FamilyMember } from '../../core/models/models';
import { QuestionStat } from '../../core/analytics/analytics';
import { percent } from '../../core/questions/grading';

/** Saves an exam's results and question analysis as an .xlsx file. */
export async function exportExamReport(
  exam: Exam,
  categoryName: string,
  attempts: Attempt[],
  stats: QuestionStat[],
  memberFor: (email: string) => FamilyMember,
) {
  const XLSX = await import('xlsx');
  const date = (t: number) => new Date(t).toLocaleString();
  const minutes = (a: Attempt) => (a.source === 'online' ? Math.round((a.submittedAt - a.startedAt) / 60_000) : '');

  const results = XLSX.utils.aoa_to_sheet([
    ['Member', 'Date', 'Points', 'Out of', 'Score %', 'Minutes', 'Source', 'Status'],
    ...attempts.map((a) => [
      memberFor(a.takenBy).name,
      date(a.submittedAt),
      a.totalScore,
      a.maxScore,
      percent(a),
      minutes(a),
      a.source === 'manual' ? 'Paper' : 'Online',
      a.gradingStatus === 'pending' ? 'Waiting for marks' : 'Marked',
    ]),
  ]);
  results['!cols'] = [18, 20, 8, 8, 8, 8, 8, 18].map((wch) => ({ wch }));

  const questions = XLSX.utils.aoa_to_sheet([
    ['#', 'Question', 'Type', 'Points', 'Times answered', 'Fully correct', 'Score %'],
    ...stats.map((s, i) => [i + 1, s.question.text, s.question.type, s.question.score, s.answered, s.correct, s.pct ?? '']),
  ]);
  questions['!cols'] = [4, 70, 16, 8, 14, 12, 8].map((wch) => ({ wch }));

  const book = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ['Exam', exam.title],
    ['Category', categoryName],
    ['Questions', exam.questionIds.length],
    ['Results', attempts.length],
    ['Exported', new Date().toLocaleString()],
  ]);
  summary['!cols'] = [{ wch: 12 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(book, summary, 'Summary');
  XLSX.utils.book_append_sheet(book, results, 'Results');
  XLSX.utils.book_append_sheet(book, questions, 'Questions');
  XLSX.writeFile(book, `${exam.title.replace(/[^\w -]/g, '')} - report.xlsx`);
}
