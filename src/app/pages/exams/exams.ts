import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Attempt, Exam } from '../../core/models/models';
import { percent } from '../../core/questions/grading';
import { AppState } from '../../core/state/app-state';
import { ThemedPipe } from '../../core/theme/theme';
import { Avatar } from '../../shared/avatar';
import { PaperResultsDialog } from './paper-results-dialog';

@Component({
  selector: 'app-exams',
  imports: [
    DatePipe,
    RouterLink,
    MatBadgeModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatMenuModule,
    MatTabsModule,
    MatTooltipModule,
    Avatar,
    ThemedPipe,
  ],
  templateUrl: './exams.html',
  styleUrl: './exams.scss',
})
export class Exams {
  protected readonly state = inject(AppState);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  protected readonly percent = percent;

  protected readonly categoryFilter = signal('');
  protected readonly exams = computed(() =>
    this.state.sortedExams().filter((e) => !this.categoryFilter() || e.categoryId === this.categoryFilter()),
  );

  protected subjectName(exam: Exam) {
    if (!exam.subjectId) return 'All subjects';
    return this.state.categoryById().get(exam.categoryId)?.subjects.find((s) => s.id === exam.subjectId)?.name ?? '';
  }

  protected totalPoints(exam: Exam) {
    return exam.questionIds.reduce((sum, id) => sum + (this.state.questionById().get(id)?.score ?? 0), 0);
  }

  protected best(exam: Exam) {
    const attempts = this.state.attemptsByExam().get(exam.id) ?? [];
    return attempts.length ? Math.max(...attempts.map(percent)) : null;
  }

  protected takers(exam: Exam) {
    const emails = new Set((this.state.attemptsByExam().get(exam.id) ?? []).map((a) => a.takenBy));
    return [...emails].map((e) => this.state.memberFor(e));
  }

  protected examTitle(attempt: Attempt) {
    return this.state.examById().get(attempt.examId)?.title ?? '(deleted exam)';
  }

  protected toGrade(attempt: Attempt) {
    return attempt.answers.filter((a) => a.isCorrect === null).length;
  }

  protected async remove(exam: Exam) {
    const results = this.state.attemptsByExam().get(exam.id)?.length ?? 0;
    const extra = results ? ` Its ${results} result(s) will be deleted too.` : '';
    if (!confirm(`Delete the exam "${exam.title}"?${extra}`)) return;
    try {
      await this.state.deleteExam(exam.id);
      this.snack.open('Exam deleted', undefined, { duration: 2000 });
    } catch (e) {
      this.snack.open((e as Error).message, 'OK', { duration: 5000 });
    }
  }

  protected importPaper() {
    this.dialog.open(PaperResultsDialog, { width: '900px', maxWidth: '95vw', autoFocus: false });
  }
}
