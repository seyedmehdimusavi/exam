import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';
import { Question } from '../../core/models/models';
import { AppState } from '../../core/state/app-state';
import { ResultRow, downloadResultsTemplate, readResultsFile, toAttempt } from './results-excel';

/** Imports scores from exams done on paper, via an Excel sheet per exam. */
@Component({
  selector: 'app-paper-results-dialog',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './paper-results-dialog.html',
  styleUrl: './paper-results-dialog.scss',
})
export class PaperResultsDialog {
  protected readonly state = inject(AppState);
  private readonly ref = inject(MatDialogRef<PaperResultsDialog>);
  private readonly snack = inject(MatSnackBar);

  protected readonly examId = signal('');
  protected readonly rows = signal<ResultRow[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly exam = computed(() => this.state.examById().get(this.examId()));
  private readonly questions = computed(() =>
    (this.exam()?.questionIds ?? []).map((id) => this.state.questionById().get(id)).filter((q): q is Question => !!q),
  );
  protected readonly ready = computed(() => this.rows().filter((r) => !r.errors.length));

  protected selectExam(id: string) {
    this.examId.set(id);
    this.rows.set([]);
    this.error.set(null);
  }

  protected async template() {
    const exam = this.exam();
    if (exam) await downloadResultsTemplate(exam, this.questions(), environment.family);
  }

  protected async onPick(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const rows = await readResultsFile(file, this.questions(), environment.family);
      if (!rows.length) throw new Error('The file has no result rows.');
      this.rows.set(rows);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async importReady() {
    const exam = this.exam();
    if (!exam || !this.ready().length) return;
    this.busy.set(true);
    try {
      await this.state.addManualAttempts(this.ready().map((r) => toAttempt(r, exam.id)));
      this.snack.open(`${this.ready().length} results imported`, undefined, { duration: 3000 });
      this.ref.close();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
