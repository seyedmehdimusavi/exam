import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { averagePct, formatDuration, questionStats } from '../../core/analytics/analytics';
import { Attempt, Exam } from '../../core/models/models';
import { percent } from '../../core/questions/grading';
import { typeInfo } from '../../core/questions/question-rules';
import { AppState } from '../../core/state/app-state';
import { BarItem, BarList } from '../../shared/charts/bar-list';
import { StatTile } from '../../shared/charts/stat-tile';
import { MemberPicker } from '../../shared/member-picker';
import { Avatar } from '../../shared/avatar';
import { ThemedPipe } from '../../core/theme/theme';
import { exportExamReport } from './report-excel';

type SortKey = 'date' | 'score';

@Component({
  selector: 'app-report',
  imports: [DatePipe, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule, BarList, MemberPicker, StatTile, Avatar, ThemedPipe],
  templateUrl: './report.html',
  styleUrl: './report.scss',
})
export class Report {
  protected readonly state = inject(AppState);
  protected readonly percent = percent;
  protected readonly typeInfo = typeInfo;

  protected readonly email = signal('');
  /** '' shows the overview of all exams. */
  protected readonly examId = signal('');
  protected readonly sort = signal<SortKey>('date');

  private readonly memberAttempts = computed(() =>
    this.state.sortedAttempts().filter((a) => !this.email() || a.takenBy.toLowerCase() === this.email().toLowerCase()),
  );

  // ---------- overview ----------
  protected readonly overview = computed(() =>
    this.state.sortedExams().map((exam) => {
      const attempts = this.memberAttempts().filter((a) => a.examId === exam.id);
      const marked = attempts.filter((a) => a.gradingStatus === 'graded');
      return {
        exam,
        category: this.state.categoryById().get(exam.categoryId),
        count: attempts.length,
        average: averagePct(marked),
        best: marked.length ? Math.max(...marked.map(percent)) : null,
        last: attempts[0]?.submittedAt ?? null,
      };
    }),
  );

  // ---------- one exam ----------
  protected readonly exam = computed(() => this.state.examById().get(this.examId()));
  protected readonly attempts = computed(() => {
    const list = this.memberAttempts().filter((a) => a.examId === this.examId());
    return this.sort() === 'score' ? [...list].sort((a, b) => percent(b) - percent(a)) : list;
  });
  private readonly marked = computed(() => this.attempts().filter((a) => a.gradingStatus === 'graded'));

  protected readonly tiles = computed(() => {
    const marked = this.marked();
    const pcts = marked.map(percent);
    const online = marked.filter((a) => a.source === 'online');
    const avgTime = online.length
      ? online.reduce((s, a) => s + Math.min(3 * 3_600_000, a.submittedAt - a.startedAt), 0) / online.length
      : null;
    const avg = averagePct(marked);
    return {
      results: this.attempts().length,
      average: avg === null ? '–' : `${avg}%`,
      best: pcts.length ? `${Math.max(...pcts)}%` : '–',
      lowest: pcts.length ? `${Math.min(...pcts)}%` : '–',
      time: avgTime === null ? '–' : formatDuration(avgTime),
    };
  });

  protected readonly stats = computed(() => {
    const exam = this.exam();
    return exam ? questionStats(exam, this.attempts(), this.state.questionById()) : [];
  });

  protected readonly questionBars = computed<BarItem[]>(() =>
    this.stats().map((s, i) => ({
      id: s.question.id,
      label: `Q${i + 1}. ${s.question.text}`,
      parts: [{ name: 'Score', value: s.pct ?? 0, color: 'var(--viz-series-1)' }],
      display: s.pct === null ? 'not answered' : `${s.pct}%`,
      note: `${s.correct} of ${s.answered} fully correct · ${typeInfo(s.question.type).label}`,
    })),
  );

  protected readonly hardest = computed(() =>
    this.stats()
      .filter((s) => s.pct !== null && s.pct < 60)
      .sort((a, b) => a.pct! - b.pct!)
      .slice(0, 3),
  );

  protected minutes(a: Attempt) {
    return a.source === 'online' ? formatDuration(Math.min(3 * 3_600_000, a.submittedAt - a.startedAt)) : 'paper';
  }

  protected open(exam: Exam) {
    this.examId.set(exam.id);
  }

  protected async export() {
    const exam = this.exam();
    if (!exam) return;
    await exportExamReport(
      exam,
      this.state.categoryById().get(exam.categoryId)?.name ?? '',
      this.attempts(),
      this.stats(),
      (e) => this.state.memberFor(e),
    );
  }
}
