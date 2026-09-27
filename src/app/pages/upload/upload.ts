import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { QuestionDraft } from '../../core/models/models';
import { typeInfo, validateDraft } from '../../core/questions/question-rules';
import { AppState } from '../../core/state/app-state';
import { EditRowDialog } from './edit-row-dialog';
import { ParsedRow, downloadTemplate, readQuestionFile } from './excel';

interface CheckedRow extends ParsedRow {
  errors: string[];
  warnings: string[];
}

@Component({
  selector: 'app-upload',
  imports: [
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './upload.html',
  styleUrl: './upload.scss',
})
export class Upload {
  protected readonly state = inject(AppState);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  protected readonly typeInfo = typeInfo;

  protected defaults = { categoryId: '', subjectName: '' };
  protected readonly fileName = signal('');
  protected readonly parsed = signal<ParsedRow[]>([]);
  protected readonly busy = signal(false);
  protected readonly dragging = signal(false);
  protected readonly onlyProblems = signal(false);
  protected readonly imported = signal<number | null>(null);
  protected readonly readError = signal<string | null>(null);

  /** Rows re-checked whenever they, the categories or the saved questions change. */
  protected readonly rows = computed<CheckedRow[]>(() => {
    const categoryById = this.state.categoryById();
    const existing = new Set(this.state.questions().map((q) => `${q.categoryId}|${q.text.trim().toLowerCase()}`));
    const seen = new Set<string>();
    return this.parsed().map((row) => {
      const { draft } = row;
      const category = categoryById.get(draft.categoryId);
      const errors = [...row.parseErrors];
      let validation = validateDraft(draft, categoryById);
      if (!category && row.categoryText) {
        // Replace the generic "Choose a category" with a message naming what the file said.
        errors.push(`Category "${row.categoryText}" doesn't exist. Fix the name or add it on the Categories page.`);
        validation = validation.filter((e) => e !== 'Choose a category.');
      }
      errors.push(...validation);

      const warnings: string[] = [];
      const dupKey = `${draft.categoryId}|${draft.text.trim().toLowerCase()}`;
      if (existing.has(dupKey)) warnings.push('A question with the same text already exists.');
      else if (seen.has(dupKey)) warnings.push('This question appears twice in the file.');
      seen.add(dupKey);
      if (category && draft.subjectName && !category.subjects.some((s) => s.name.toLowerCase() === draft.subjectName.trim().toLowerCase())) {
        warnings.push(`New subject "${draft.subjectName.trim()}" will be created.`);
      }
      return { ...row, errors, warnings };
    });
  });

  protected readonly ready = computed(() => this.rows().filter((r) => r.errors.length === 0));
  protected readonly problems = computed(() => this.rows().length - this.ready().length);
  protected readonly visibleRows = computed(() =>
    this.onlyProblems() ? this.rows().filter((r) => r.errors.length) : this.rows(),
  );

  protected async template() {
    await downloadTemplate(this.state.sortedCategories());
  }

  protected onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.read(file);
  }

  protected onPick(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (file) this.read(file);
  }

  private async read(file: File) {
    if (!/\.xlsx?$/i.test(file.name)) {
      this.readError.set('Please choose an Excel file (.xlsx).');
      return;
    }
    this.busy.set(true);
    this.readError.set(null);
    this.imported.set(null);
    try {
      const rows = await readQuestionFile(file, this.state.sortedCategories(), this.defaults);
      if (rows.length === 0) throw new Error('The file has no question rows.');
      this.parsed.set(rows);
      this.fileName.set(file.name);
      this.onlyProblems.set(false);
    } catch (e) {
      this.readError.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected edit(row: CheckedRow) {
    this.dialog
      .open<EditRowDialog, { draft: QuestionDraft; rowNumber: number }, QuestionDraft>(EditRowDialog, {
        data: { draft: row.draft, rowNumber: row.rowNumber },
        width: '760px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((draft) => {
        if (!draft) return;
        this.parsed.update((rows) =>
          rows.map((r) => (r.rowNumber === row.rowNumber ? { ...r, draft, categoryText: '', parseErrors: [] } : r)),
        );
      });
  }

  protected removeRow(row: CheckedRow) {
    this.parsed.update((rows) => rows.filter((r) => r.rowNumber !== row.rowNumber));
  }

  protected async importReady() {
    const drafts = this.ready().map((r) => r.draft);
    if (!drafts.length) return;
    this.busy.set(true);
    try {
      const count = await this.state.addQuestions(drafts);
      const importedRows = new Set(this.ready().map((r) => r.rowNumber));
      this.parsed.update((rows) => rows.filter((r) => !importedRows.has(r.rowNumber)));
      this.imported.set(count);
    } catch (e) {
      this.snack.open((e as Error).message, 'OK', { duration: 6000 });
    } finally {
      this.busy.set(false);
    }
  }

  protected reset() {
    this.parsed.set([]);
    this.fileName.set('');
    this.imported.set(null);
    this.readError.set(null);
  }

  protected answerText(row: CheckedRow) {
    return row.draft.correctAnswers.join(' / ');
  }
}
