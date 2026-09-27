import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Question, QuestionDraft } from '../../core/models/models';
import { questionToDraft, startOfToday, typeInfo } from '../../core/questions/question-rules';
import { AppState } from '../../core/state/app-state';
import { ThemedPipe } from '../../core/theme/theme';
import { Avatar } from '../../shared/avatar';
import { QuestionForm } from '../../shared/question-form/question-form';

const CHEERS = ['Saved. Great job!', 'Saved. Nice one!', 'Saved. Keep going!', 'Saved. Awesome work!'];

@Component({
  selector: 'app-create-question',
  imports: [MatButtonModule, MatButtonToggleModule, MatCardModule, MatIconModule, MatTooltipModule, QuestionForm, Avatar, ThemedPipe],
  templateUrl: './create-question.html',
  styleUrl: './create-question.scss',
})
export class CreateQuestion {
  protected readonly state = inject(AppState);
  private readonly snack = inject(MatSnackBar);
  protected readonly typeInfo = typeInfo;

  protected readonly editing = signal<Question | null>(null);
  protected readonly editingDraft = computed(() => {
    const q = this.editing();
    return q ? questionToDraft(q, this.state.categoryById()) : null;
  });
  protected readonly onlyMine = signal(true);

  private readonly me = computed(() => this.state.currentUser()?.email);
  protected readonly madeToday = computed(
    () => this.state.questions().filter((q) => q.createdBy === this.me() && q.createdAt >= startOfToday()).length,
  );
  protected readonly recent = computed(() =>
    this.state
      .questions()
      .filter((q) => !this.onlyMine() || q.createdBy === this.me())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20),
  );

  protected readonly save = async (draft: QuestionDraft) => {
    const editing = this.editing();
    try {
      if (editing) {
        await this.state.updateQuestion(editing.id, draft);
        this.editing.set(null);
        this.snack.open('Question updated', undefined, { duration: 2000 });
      } else {
        await this.state.addQuestion(draft);
        this.snack.open(CHEERS[Math.floor(Math.random() * CHEERS.length)], undefined, { duration: 2000 });
      }
    } catch (e) {
      this.snack.open((e as Error).message, 'OK', { duration: 5000 });
      throw e;
    }
  };

  protected edit(q: Question) {
    this.editing.set(q);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected async remove(q: Question) {
    if (!confirm('Delete this question?')) return;
    try {
      await this.state.deleteQuestion(q.id);
      if (this.editing()?.id === q.id) this.editing.set(null);
    } catch (e) {
      this.snack.open((e as Error).message, 'OK', { duration: 5000 });
    }
  }

  protected subjectName(q: Question) {
    return this.state.categoryById().get(q.categoryId)?.subjects.find((s) => s.id === q.subjectId)?.name ?? '';
  }
}
