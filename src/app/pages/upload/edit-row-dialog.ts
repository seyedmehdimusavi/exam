import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { QuestionDraft } from '../../core/models/models';
import { QuestionForm } from '../../shared/question-form/question-form';

/** Fixes one uploaded row with the same form used on the Create Question page. */
@Component({
  selector: 'app-edit-row-dialog',
  imports: [MatDialogModule, QuestionForm],
  template: `
    <h2 mat-dialog-title>Fix row {{ data.rowNumber }}</h2>
    <mat-dialog-content>
      <app-question-form
        [initial]="data.draft"
        submitLabel="Use these changes"
        [showCancel]="true"
        [save]="save"
        (cancelled)="ref.close()"
      />
    </mat-dialog-content>
  `,
})
export class EditRowDialog {
  protected readonly data = inject<{ draft: QuestionDraft; rowNumber: number }>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<EditRowDialog, QuestionDraft>>(MatDialogRef);
  protected readonly save = async (draft: QuestionDraft) => this.ref.close(draft);
}
