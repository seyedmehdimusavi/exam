import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { attemptsIn, averagePct, lastDays, questionsCreated, scoreBy } from '../../core/analytics/analytics';
import { Attempt } from '../../core/models/models';
import { percent } from '../../core/questions/grading';
import { AppState } from '../../core/state/app-state';
import { BarItem, BarList } from '../../shared/charts/bar-list';
import { LineChart, LinePoint } from '../../shared/charts/line-chart';
import { StatTile } from '../../shared/charts/stat-tile';
import { MemberPicker } from '../../shared/member-picker';
import { Avatar } from '../../shared/avatar';
import { ThemedPipe, themed } from '../../core/theme/theme';

/** Subjects need this many marked answers before they're called strong or weak. */
const MIN_ANSWERS = 3;

@Component({
  selector: 'app-progress',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    BarList,
    LineChart,
    MemberPicker,
    StatTile,
    Avatar,
    ThemedPipe,
  ],
  templateUrl: './progress.html',
  styleUrl: './progress.scss',
})
export class Progress {
  protected readonly state = inject(AppState);

  protected readonly email = signal('');
  protected readonly days = signal<number | null>(30);
  protected readonly categoryId = signal('');

  private readonly inCategory = (a: Attempt) =>
    !this.categoryId() || this.state.examById().get(a.examId)?.categoryId === this.categoryId();

  /** All attempts in range for the member and category, oldest first. */
  private readonly attempts = computed(() =>
    attemptsIn(this.state.attempts(), lastDays(this.days()), this.email())
      .filter(this.inCategory)
      .sort((a, b) => a.submittedAt - b.submittedAt),
  );
  private readonly marked = computed(() => this.attempts().filter((a) => a.gradingStatus === 'graded'));
  protected readonly waiting = computed(() => this.attempts().length - this.marked().length);

  protected readonly tiles = computed(() => {
    const marked = this.marked();
    const avg = averagePct(marked);
    const best = marked.length ? Math.max(...marked.map(percent)) : null;
    const recent = averagePct(marked.slice(-5));
    const before = averagePct(marked.slice(-10, -5));
    const change = recent !== null && before !== null ? recent - before : null;
    const created = questionsCreated(this.state.questions(), lastDays(this.days()), this.email()).filter(
      (q) => !this.categoryId() || q.categoryId === this.categoryId(),
    ).length;
    return {
      exams: this.attempts().length,
      average: avg === null ? '–' : `${avg}%`,
      best: best === null ? '–' : `${best}%`,
      trend: change === null ? '–' : `${change > 0 ? '+' : ''}${change}%`,
      trendDir: change === null || change === 0 ? null : change > 0 ? ('up' as const) : ('down' as const),
      trendNote: change === null ? 'Needs 6+ results' : 'Last 5 vs the 5 before',
      created,
    };
  });

  protected readonly line = computed<LinePoint[]>(() =>
    this.marked().map((a) => {
      const exam = this.state.examById().get(a.examId);
      return {
        time: a.submittedAt,
        value: percent(a),
        title: exam?.title ?? 'Exam',
        subtitle: [this.state.categoryById().get(exam?.categoryId ?? '')?.name, !this.email() && this.state.memberFor(a.takenBy).name]
          .filter(Boolean)
          .join(' · '),
      };
    }),
  );

  protected readonly byCategory = computed<BarItem[]>(() => {
    const groups = scoreBy(this.marked(), this.state.questionById(), this.state.examById(), (q) => q.categoryId, (e) => e.categoryId);
    return groups
      .map((g) => {
        const c = this.state.categoryById().get(g.id);
        return {
          id: g.id,
          label: c?.name ?? 'Unknown',
          color: themed(c?.color),
          parts: [{ name: 'Score', value: g.pct, color: themed(c?.color) }],
          display: `${g.pct}%`,
          note: `${g.earned} of ${g.possible} points`,
        };
      })
      .sort((a, b) => b.parts[0].value - a.parts[0].value);
  });

  private readonly subjects = computed(() => {
    const groups = scoreBy(this.marked(), this.state.questionById(), this.state.examById(), (q) => `${q.categoryId}|${q.subjectId}`);
    return groups
      .filter((g) => g.count >= MIN_ANSWERS)
      .map((g) => {
        const [categoryId, subjectId] = g.id.split('|');
        const c = this.state.categoryById().get(categoryId);
        const subject = c?.subjects.find((s) => s.id === subjectId)?.name ?? 'Unknown';
        return {
          id: g.id,
          label: this.categoryId() ? subject : `${subject} (${c?.name ?? ''})`,
          color: themed(c?.color),
          parts: [{ name: 'Score', value: g.pct, color: themed(c?.color) }],
          display: `${g.pct}%`,
          note: `${g.count} answers`,
        } satisfies BarItem;
      });
  });
  protected readonly strongest = computed(() =>
    [...this.subjects()].sort((a, b) => b.parts[0].value - a.parts[0].value).slice(0, 5),
  );
  protected readonly practise = computed(() =>
    [...this.subjects()]
      .filter((s) => s.parts[0].value < 80)
      .sort((a, b) => a.parts[0].value - b.parts[0].value)
      .slice(0, 5),
  );

  protected readonly history = computed(() => [...this.attempts()].reverse().slice(0, 20));

  protected examTitle(a: Attempt) {
    return this.state.examById().get(a.examId)?.title ?? '(deleted exam)';
  }

  protected readonly percent = percent;
  protected readonly minAnswers = MIN_ANSWERS;
}
