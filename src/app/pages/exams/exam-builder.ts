import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { Difficulty, Question, QuestionType } from '../../core/models/models';
import { DIFFICULTIES, QUESTION_TYPES, typeInfo } from '../../core/questions/question-rules';
import { AppState } from '../../core/state/app-state';
import { ThemedPipe } from '../../core/theme/theme';

@Component({
  selector: 'app-exam-builder',
  imports: [
    ThemedPipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './exam-builder.html',
  styleUrl: './exam-builder.scss',
})
export class ExamBuilder {
  protected readonly state = inject(AppState);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  protected readonly types = QUESTION_TYPES;
  protected readonly difficulties = DIFFICULTIES;
  protected readonly typeInfo = typeInfo;

  /** Route param; absent when creating a new exam. */
  readonly id = input<string>();

  protected readonly title = signal('');
  protected readonly categoryId = signal('');
  protected readonly subjectId = signal('');
  protected readonly timed = signal(false);
  protected readonly durationMin = signal(20);
  protected readonly selectedIds = signal<string[]>([]);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  private loadedExamId = '';

  // Pool filters
  protected readonly search = signal('');
  protected readonly typeFilter = signal<QuestionType | ''>('');
  protected readonly difficultyFilter = signal<Difficulty | ''>('');
  // Random pick
  protected randomCount = 5;
  protected randomDifficulty: Difficulty | '' = '';

  protected readonly category = computed(() => this.state.categoryById().get(this.categoryId()));
  protected readonly selected = computed(() =>
    this.selectedIds().map((id) => this.state.questionById().get(id)).filter((q): q is Question => !!q),
  );
  protected readonly selectedSet = computed(() => new Set(this.selectedIds()));
  protected readonly totalPoints = computed(() => this.selected().reduce((s, q) => s + q.score, 0));

  /** Questions in the chosen category/subject, before the search/type/difficulty filters. */
  private readonly scope = computed(() =>
    this.state
      .questions()
      .filter((q) => q.categoryId === this.categoryId() && (!this.subjectId() || q.subjectId === this.subjectId()))
      .sort((a, b) => b.createdAt - a.createdAt),
  );
  protected readonly pool = computed(() => {
    const text = this.search().trim().toLowerCase();
    return this.scope().filter(
      (q) =>
        (!text || q.text.toLowerCase().includes(text) || q.tags.some((t) => t.toLowerCase().includes(text))) &&
        (!this.typeFilter() || q.type === this.typeFilter()) &&
        (!this.difficultyFilter() || q.difficulty === this.difficultyFilter()),
    );
  });
  protected readonly allShownSelected = computed(
    () => this.pool().length > 0 && this.pool().every((q) => this.selectedSet().has(q.id)),
  );

  protected readonly errors = computed(() => {
    const errors: string[] = [];
    if (!this.title().trim()) errors.push('Give the exam a title.');
    if (!this.category()) errors.push('Choose a category.');
    if (!this.selectedIds().length) errors.push('Add at least one question.');
    if (this.timed() && !(this.durationMin() > 0)) errors.push('Time limit must be more than 0 minutes.');
    return errors;
  });

  constructor() {
    // Load the exam once data is available (edit mode).
    effect(() => {
      const id = this.id();
      const exam = id ? this.state.examById().get(id) : undefined;
      if (!exam || this.loadedExamId === exam.id) return;
      this.loadedExamId = exam.id;
      untracked(() => {
        this.title.set(exam.title);
        this.categoryId.set(exam.categoryId);
        this.subjectId.set(exam.subjectId);
        this.timed.set(exam.durationMin !== null);
        this.durationMin.set(exam.durationMin ?? 20);
        this.selectedIds.set([...exam.questionIds]);
      });
    });
  }

  protected setCategory(id: string) {
    if (id === this.categoryId()) return;
    if (this.selectedIds().length && !confirm('Changing the category removes the questions you picked. Continue?')) return;
    this.categoryId.set(id);
    this.subjectId.set('');
    this.selectedIds.set([]);
  }

  protected subjectName(q: Question) {
    return this.category()?.subjects.find((s) => s.id === q.subjectId)?.name ?? '';
  }

  protected toggle(q: Question) {
    this.selectedIds.update((ids) => (ids.includes(q.id) ? ids.filter((i) => i !== q.id) : [...ids, q.id]));
  }

  protected toggleAllShown() {
    const shown = this.pool().map((q) => q.id);
    if (this.allShownSelected()) {
      const drop = new Set(shown);
      this.selectedIds.update((ids) => ids.filter((i) => !drop.has(i)));
    } else {
      this.selectedIds.update((ids) => [...ids, ...shown.filter((i) => !ids.includes(i))]);
    }
  }

  protected addRandom() {
    const candidates = this.scope().filter(
      (q) => !this.selectedSet().has(q.id) && (!this.randomDifficulty || q.difficulty === this.randomDifficulty),
    );
    if (!candidates.length) {
      this.snack.open('No more questions match.', undefined, { duration: 2500 });
      return;
    }
    const picked = shuffle(candidates).slice(0, Math.max(1, this.randomCount));
    this.selectedIds.update((ids) => [...ids, ...picked.map((q) => q.id)]);
    if (picked.length < this.randomCount) {
      this.snack.open(`Only ${picked.length} more questions were available.`, undefined, { duration: 2500 });
    }
  }

  protected move(index: number, delta: number) {
    this.selectedIds.update((ids) => {
      const next = [...ids];
      const target = index + delta;
      if (target < 0 || target >= next.length) return ids;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  protected removeAt(index: number) {
    this.selectedIds.update((ids) => ids.filter((_, i) => i !== index));
  }

  protected shuffleSelected() {
    this.selectedIds.update((ids) => shuffle(ids));
  }

  protected async save(thenStart = false) {
    this.submitted.set(true);
    if (this.errors().length || this.saving()) return;
    this.saving.set(true);
    try {
      const id = await this.state.saveExam(
        {
          title: this.title().trim(),
          categoryId: this.categoryId(),
          subjectId: this.subjectId(),
          questionIds: this.selectedIds(),
          durationMin: this.timed() ? Number(this.durationMin()) : null,
        },
        this.id(),
      );
      this.snack.open('Exam saved', undefined, { duration: 2000 });
      await this.router.navigate(thenStart ? ['/exams', id, 'take'] : ['/exams']);
    } catch (e) {
      this.snack.open((e as Error).message, 'OK', { duration: 5000 });
    } finally {
      this.saving.set(false);
    }
  }
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
