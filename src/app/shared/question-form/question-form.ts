import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { TextFieldModule } from '@angular/cdk/text-field';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { QuestionDraft, QuestionType } from '../../core/models/models';
import {
  DIFFICULTIES,
  MAX_OPTIONS,
  OPTION_LETTERS,
  QUESTION_TYPES,
  TRUE_FALSE,
  emptyDraft,
  normalizeDraft,
  validateDraft,
  withTypeDefaults,
} from '../../core/questions/question-rules';
import { AppState } from '../../core/state/app-state';
import { ThemedPipe } from '../../core/theme/theme';

/**
 * Friendly form for one question. Emits `saved` with a valid draft.
 * With `resetOnSave`, it clears afterwards but keeps category, subject, type and difficulty,
 * so the next question is quick to add.
 */
@Component({
  selector: 'app-question-form',
  imports: [
    ThemedPipe,
    FormsModule,
    TextFieldModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './question-form.html',
  styleUrl: './question-form.scss',
})
export class QuestionForm {
  protected readonly state = inject(AppState);
  protected readonly types = QUESTION_TYPES;
  protected readonly difficulties = DIFFICULTIES;
  protected readonly letters = OPTION_LETTERS;
  protected readonly trueFalse = TRUE_FALSE;
  protected readonly maxOptions = MAX_OPTIONS;

  readonly initial = input<QuestionDraft | null>(null);
  readonly submitLabel = input('Save question');
  readonly showCancel = input(false);
  readonly resetOnSave = input(false);
  /** The parent runs the save; the form shows a spinner until it resolves. */
  readonly save = input.required<(draft: QuestionDraft) => Promise<void>>();
  readonly cancelled = output<void>();

  protected draft: QuestionDraft = emptyDraft();
  protected tagsText = '';
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly categoryId = signal('');
  protected readonly subjectQuery = signal('');

  protected readonly subjects = computed(() => this.state.categoryById().get(this.categoryId())?.subjects ?? []);
  protected readonly filteredSubjects = computed(() => {
    const q = this.subjectQuery().trim().toLowerCase();
    return this.subjects().filter((s) => s.name.toLowerCase().includes(q));
  });
  protected readonly isNewSubject = computed(() => {
    const q = this.subjectQuery().trim().toLowerCase();
    return !!q && !this.subjects().some((s) => s.name.toLowerCase() === q);
  });

  constructor() {
    effect(() => this.load(this.initial() ?? emptyDraft()));
  }

  protected errors(): string[] {
    return validateDraft(this.buildDraft(), this.state.categoryById());
  }

  protected setCategory(id: string) {
    if (id === this.draft.categoryId) return;
    this.draft.categoryId = id;
    this.categoryId.set(id);
    this.setSubject('');
  }

  protected setSubject(name: string) {
    this.draft.subjectName = name;
    this.subjectQuery.set(name);
  }

  protected setType(type: QuestionType) {
    this.draft = withTypeDefaults({ ...this.draft, type, correctAnswers: [] });
    if (type === 'short-answer') this.draft.correctAnswers = [''];
  }

  // ----- multiple choice -----
  protected isCorrect(option: string) {
    return !!option.trim() && this.draft.correctAnswers.includes(option);
  }

  protected toggleCorrect(i: number) {
    const option = this.draft.options[i];
    if (!option.trim()) return;
    this.draft.correctAnswers = this.isCorrect(option)
      ? this.draft.correctAnswers.filter((a) => a !== option)
      : [...this.draft.correctAnswers, option];
  }

  /** Keeps the correct-answer mark attached to an option while its text is edited. */
  protected editOption(i: number, value: string) {
    const old = this.draft.options[i];
    this.draft.options = this.draft.options.map((o, j) => (j === i ? value : o));
    this.draft.correctAnswers = this.draft.correctAnswers.map((a) => (a === old ? value : a));
  }

  protected addOption() {
    if (this.draft.options.length < MAX_OPTIONS) this.draft.options = [...this.draft.options, ''];
  }

  protected removeOption(i: number) {
    const removed = this.draft.options[i];
    this.draft.options = this.draft.options.filter((_, j) => j !== i);
    this.draft.correctAnswers = this.draft.correctAnswers.filter((a) => a !== removed);
  }

  // ----- short answer -----
  protected editAnswer(i: number, value: string) {
    this.draft.correctAnswers = this.draft.correctAnswers.map((a, j) => (j === i ? value : a));
  }

  protected addAnswer() {
    this.draft.correctAnswers = [...this.draft.correctAnswers, ''];
  }

  protected removeAnswer(i: number) {
    this.draft.correctAnswers = this.draft.correctAnswers.filter((_, j) => j !== i);
  }

  // ----- essay -----
  protected get modelAnswer() {
    return this.draft.correctAnswers[0] ?? '';
  }
  protected set modelAnswer(value: string) {
    this.draft.correctAnswers = value ? [value] : [];
  }

  protected async submit() {
    this.submitted.set(true);
    if (this.errors().length || this.busy()) return;
    this.busy.set(true);
    try {
      await this.save()(normalizeDraft(this.buildDraft()));
      if (this.resetOnSave()) {
        const d = this.draft;
        this.load(emptyDraft({ categoryId: d.categoryId, subjectName: d.subjectName, type: d.type, difficulty: d.difficulty, score: d.score }));
      }
    } catch {
      // The parent reports the error; keep what was typed so nothing is lost.
    } finally {
      this.busy.set(false);
    }
  }

  private buildDraft(): QuestionDraft {
    return { ...this.draft, tags: this.tagsText.split(',') };
  }

  private load(draft: QuestionDraft) {
    this.draft = withTypeDefaults(structuredClone(draft));
    if (this.draft.type === 'short-answer' && this.draft.correctAnswers.length === 0) this.draft.correctAnswers = [''];
    this.tagsText = draft.tags.join(', ');
    this.categoryId.set(draft.categoryId);
    this.subjectQuery.set(draft.subjectName);
    this.submitted.set(false);
  }
}
