import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import {
  answerTally,
  attemptsIn,
  dayRange,
  daysEnding,
  formatDuration,
  questionsCreated,
  timeSpentMs,
} from '../../core/analytics/analytics';
import { percent } from '../../core/questions/grading';
import { AppState } from '../../core/state/app-state';
import { BarItem, BarList } from '../../shared/charts/bar-list';
import { Column, ColumnChart, ColumnSeries } from '../../shared/charts/column-chart';
import { StatTile } from '../../shared/charts/stat-tile';
import { MemberPicker } from '../../shared/member-picker';
import { themed } from '../../core/theme/theme';

interface FeedItem {
  time: number;
  icon: string;
  text: string;
  detail: string;
  link?: unknown[];
}

@Component({
  selector: 'app-today',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, BarList, ColumnChart, MemberPicker, StatTile],
  templateUrl: './today.html',
  styleUrl: './today.scss',
})
export class Today {
  protected readonly state = inject(AppState);

  protected readonly email = signal('');
  protected readonly day = signal(new Date());
  protected readonly isToday = computed(() => dayRange(this.day()).start === dayRange(new Date()).start);

  private readonly range = computed(() => dayRange(this.day()));
  private readonly created = computed(() => questionsCreated(this.state.questions(), this.range(), this.email()));
  private readonly attempts = computed(() => attemptsIn(this.state.attempts(), this.range(), this.email()));
  protected readonly tally = computed(() => answerTally(this.attempts()));

  protected readonly tiles = computed(() => {
    const { right, wrong } = this.tally();
    const answered = right + wrong;
    const points = this.attempts().reduce((s, a) => s + a.totalScore, 0);
    return {
      created: this.created().length,
      exams: this.attempts().length,
      right: answered ? `${right} / ${answered}` : '0',
      accuracy: answered ? `${Math.round((right / answered) * 100)}% correct` : 'No answers yet',
      time: formatDuration(timeSpentMs(this.attempts())),
      points,
    };
  });

  protected readonly isEmpty = computed(() => !this.created().length && !this.attempts().length);

  protected readonly rightWrongByCategory = computed<BarItem[]>(() => {
    const byCategory = new Map<string, { right: number; wrong: number }>();
    for (const a of this.attempts()) {
      for (const ans of a.answers) {
        const q = this.state.questionById().get(ans.questionId);
        if (!q || ans.isCorrect === null) continue;
        const t = byCategory.get(q.categoryId) ?? { right: 0, wrong: 0 };
        if (ans.isCorrect) t.right++;
        else t.wrong++;
        byCategory.set(q.categoryId, t);
      }
    }
    return this.state
      .sortedCategories()
      .filter((c) => byCategory.has(c.id))
      .map((c) => {
        const t = byCategory.get(c.id)!;
        return {
          id: c.id,
          label: c.name,
          color: themed(c.color),
          parts: [
            { name: 'Right', value: t.right, color: 'var(--viz-good)' },
            { name: 'Wrong', value: t.wrong, color: 'var(--viz-critical)' },
          ],
          display: `${t.right} / ${t.right + t.wrong}`,
        };
      });
  });

  protected readonly createdByCategory = computed<BarItem[]>(() =>
    this.state
      .sortedCategories()
      .map((c) => ({
        id: c.id,
        label: c.name,
        color: themed(c.color),
        parts: [{ name: 'Questions', value: this.created().filter((q) => q.categoryId === c.id).length, color: themed(c.color) }],
      }))
      .filter((item) => item.parts[0].value > 0),
  );

  protected readonly weekSeries: ColumnSeries[] = [
    { name: 'Questions created', color: 'var(--viz-series-1)' },
    { name: 'Questions answered', color: 'var(--viz-series-2)' },
  ];
  protected readonly week = computed<Column[]>(() => {
    const selected = this.range().start;
    return daysEnding(this.day(), 7).map((d) => ({
      label: d.date.toLocaleDateString(undefined, { weekday: 'short' }),
      values: [
        questionsCreated(this.state.questions(), d, this.email()).length,
        attemptsIn(this.state.attempts(), d, this.email()).reduce((s, a) => s + a.answers.length, 0),
      ],
      highlight: d.start === selected,
    }));
  });

  protected readonly feed = computed<FeedItem[]>(() => {
    const items: FeedItem[] = [
      ...this.created().map((q) => ({
        time: q.createdAt,
        icon: 'edit_note',
        text: 'Created a question',
        detail: `${this.state.categoryById().get(q.categoryId)?.name ?? ''}: ${q.text}`,
      })),
      ...this.attempts().map((a) => ({
        time: a.submittedAt,
        icon: a.source === 'manual' ? 'description' : 'quiz',
        text: `${a.source === 'manual' ? 'Paper exam' : 'Finished'} "${this.state.examById().get(a.examId)?.title ?? 'exam'}"`,
        detail: `${percent(a)}% · ${a.totalScore} of ${a.maxScore} points${a.gradingStatus === 'pending' ? ' · waiting for marks' : ''}`,
        link: ['/attempts', a.id],
      })),
    ];
    return items.sort((a, b) => b.time - a.time);
  });

  protected now() {
    return new Date();
  }

  protected shiftDay(delta: number) {
    const d = new Date(this.day());
    d.setDate(d.getDate() + delta);
    this.day.set(d);
  }

  protected memberName() {
    return this.email() ? this.state.memberFor(this.email()).name : 'The family';
  }
}
