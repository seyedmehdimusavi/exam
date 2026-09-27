import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { Question } from '../../core/models/models';
import { OPTION_LETTERS } from '../../core/questions/question-rules';
import { AppState } from '../../core/state/app-state';
import { ThemedPipe } from '../../core/theme/theme';

interface SavedProgress {
  answers: Record<string, string[]>;
  startedAt: number;
  index: number;
}

@Component({
  selector: 'app-take-exam',
  imports: [
    ThemedPipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './take-exam.html',
  styleUrl: './take-exam.scss',
})
export class TakeExam {
  protected readonly state = inject(AppState);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  protected readonly letters = OPTION_LETTERS;

  readonly id = input.required<string>();

  protected readonly phase = signal<'intro' | 'running' | 'submitting'>('intro');
  protected readonly answers = signal<Record<string, string[]>>({});
  protected readonly index = signal(0);
  private startedAt = 0;
  private timer?: ReturnType<typeof setInterval>;
  protected readonly remainingMs = signal<number | null>(null);

  protected readonly exam = computed(() => this.state.examById().get(this.id()));
  protected readonly category = computed(() => this.state.categoryById().get(this.exam()?.categoryId ?? ''));
  protected readonly questions = computed(() =>
    (this.exam()?.questionIds ?? []).map((id) => this.state.questionById().get(id)).filter((q): q is Question => !!q),
  );
  protected readonly current = computed(() => this.questions()[this.index()]);
  protected readonly totalPoints = computed(() => this.questions().reduce((s, q) => s + q.score, 0));
  protected readonly answeredCount = computed(
    () => this.questions().filter((q) => this.isAnswered(q)).length,
  );
  protected readonly saved = computed(() => this.readProgress());
  protected readonly clock = computed(() => {
    const ms = this.remainingMs();
    if (ms === null) return '';
    const total = Math.ceil(ms / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  // ---------- flow ----------
  protected start(resume: boolean) {
    const saved = resume ? this.readProgress() : null;
    this.answers.set(saved?.answers ?? {});
    this.index.set(Math.min(saved?.index ?? 0, this.questions().length - 1));
    this.startedAt = saved?.startedAt ?? Date.now();
    this.phase.set('running');
    this.saveProgress();
    this.startTimer();
  }

  protected go(i: number) {
    this.index.set(Math.max(0, Math.min(this.questions().length - 1, i)));
    this.saveProgress();
  }

  protected finish() {
    const missing = this.questions().length - this.answeredCount();
    const message = missing
      ? `You haven't answered ${missing} question(s). Finish anyway?`
      : 'Finish the exam and see your score?';
    if (confirm(message)) this.submit();
  }

  private async submit() {
    const exam = this.exam();
    if (!exam || this.phase() === 'submitting') return;
    clearInterval(this.timer);
    this.phase.set('submitting');
    try {
      const attemptId = await this.state.submitAttempt(exam, this.answers(), this.startedAt);
      this.clearProgress();
      await this.router.navigate(['/attempts', attemptId], { queryParams: { done: 1 } });
    } catch (e) {
      this.phase.set('running');
      this.snack.open((e as Error).message, 'OK', { duration: 6000 });
    }
  }

  private startTimer() {
    const minutes = this.exam()?.durationMin;
    if (!minutes) return;
    const deadline = this.startedAt + minutes * 60_000;
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      this.remainingMs.set(left);
      if (left === 0) {
        this.snack.open("Time's up! Your answers were submitted.", undefined, { duration: 4000 });
        this.submit();
      }
    };
    tick();
    this.timer = setInterval(tick, 1000);
  }

  // ---------- answers ----------
  protected isAnswered(q: Question) {
    return (this.answers()[q.id] ?? []).some((a) => a.trim());
  }

  protected isMulti(q: Question) {
    return q.type === 'multiple-choice' && q.correctAnswers.length > 1;
  }

  protected chosen(q: Question, option: string) {
    return (this.answers()[q.id] ?? []).includes(option);
  }

  protected choose(q: Question, option: string) {
    const current = this.answers()[q.id] ?? [];
    const next = this.isMulti(q)
      ? current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option]
      : [option];
    this.setAnswer(q, next);
  }

  protected text(q: Question) {
    return this.answers()[q.id]?.[0] ?? '';
  }

  protected setText(q: Question, value: string) {
    this.setAnswer(q, [value]);
  }

  private setAnswer(q: Question, value: string[]) {
    this.answers.update((a) => ({ ...a, [q.id]: value }));
    this.saveProgress();
  }

  // ---------- progress kept on this device, so a refresh doesn't lose answers ----------
  private get storageKey() {
    return `exam-progress:${this.state.currentUser()?.email}:${this.id()}`;
  }

  private readProgress(): SavedProgress | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? (JSON.parse(raw) as SavedProgress) : null;
    } catch {
      return null;
    }
  }

  private saveProgress() {
    try {
      const progress: SavedProgress = { answers: this.answers(), startedAt: this.startedAt, index: this.index() };
      localStorage.setItem(this.storageKey, JSON.stringify(progress));
    } catch {
      // Storage unavailable (private mode); the exam still works, just without resume.
    }
  }

  private clearProgress() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // ignore
    }
  }
}
