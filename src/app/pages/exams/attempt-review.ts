import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { AttemptAnswer, Question } from '../../core/models/models';
import { percent, resultMood } from '../../core/questions/grading';
import { OPTION_LETTERS, typeInfo } from '../../core/questions/question-rules';
import { AppState } from '../../core/state/app-state';

interface ReviewItem {
  question: Question;
  answer: AttemptAnswer;
}

@Component({
  selector: 'app-attempt-review',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './attempt-review.html',
  styleUrl: './attempt-review.scss',
})
export class AttemptReview {
  protected readonly state = inject(AppState);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  protected readonly letters = OPTION_LETTERS;
  protected readonly typeInfo = typeInfo;

  readonly id = input.required<string>();
  /** Set right after finishing an exam, to show a celebration. */
  readonly done = input<string>();

  protected readonly attempt = computed(() => this.state.attempts().find((a) => a.id === this.id()));
  protected readonly exam = computed(() => this.state.examById().get(this.attempt()?.examId ?? ''));
  protected readonly category = computed(() => this.state.categoryById().get(this.exam()?.categoryId ?? ''));
  protected readonly member = computed(() => this.state.memberFor(this.attempt()?.takenBy ?? ''));
  protected readonly pct = computed(() => {
    const a = this.attempt();
    return a ? percent(a) : 0;
  });
  protected readonly mood = computed(() => resultMood(this.pct()));

  protected readonly items = computed<ReviewItem[]>(() =>
    (this.attempt()?.answers ?? [])
      .map((answer) => ({ answer, question: this.state.questionById().get(answer.questionId)! }))
      .filter((item) => !!item.question),
  );
  protected readonly stats = computed(() => {
    const answers = this.attempt()?.answers ?? [];
    return {
      correct: answers.filter((a) => a.isCorrect === true).length,
      wrong: answers.filter((a) => a.isCorrect === false).length,
      pending: answers.filter((a) => a.isCorrect === null).length,
    };
  });

  /** Marks being typed in, by question id. Only touched answers are saved. */
  protected readonly grades = signal<Record<string, { score: number; feedback: string }>>({});
  protected readonly saving = signal(false);

  protected gradeFor(item: ReviewItem): { score: number | null; feedback: string } {
    return (
      this.grades()[item.question.id] ?? {
        score: item.answer.isCorrect === null ? null : item.answer.score,
        feedback: item.answer.feedback ?? '',
      }
    );
  }

  protected setGrade(item: ReviewItem, change: Partial<{ score: number; feedback: string }>) {
    const current = this.gradeFor(item);
    this.grades.update((g) => ({
      ...g,
      [item.question.id]: { score: Number(change.score ?? current.score ?? 0), feedback: change.feedback ?? current.feedback },
    }));
  }

  protected hasUnsaved() {
    return Object.keys(this.grades()).length > 0;
  }

  protected async saveGrades() {
    const attempt = this.attempt();
    if (!attempt || !this.hasUnsaved()) return;
    this.saving.set(true);
    try {
      await this.state.gradeAttempt(attempt, this.grades());
      this.grades.set({});
      this.snack.open('Marks saved', undefined, { duration: 2000 });
    } catch (e) {
      this.snack.open((e as Error).message, 'OK', { duration: 5000 });
    } finally {
      this.saving.set(false);
    }
  }

  /** Short answers are matched strictly; this accepts a spelling the question didn't list. */
  protected async accept(item: ReviewItem) {
    const attempt = this.attempt();
    if (!attempt) return;
    await this.state.gradeAttempt(attempt, { [item.question.id]: { score: item.question.score, feedback: '' } });
  }

  protected isChosen(item: ReviewItem, option: string) {
    return item.answer.answer.includes(option);
  }

  protected isRight(item: ReviewItem, option: string) {
    return item.question.correctAnswers.includes(option);
  }

  protected async remove() {
    const attempt = this.attempt();
    if (!attempt || !confirm('Delete this result?')) return;
    await this.state.deleteAttempt(attempt.id);
    await this.router.navigate(['/exams']);
  }
}
