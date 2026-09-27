import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Category, Subject } from '../../core/models/models';
import { AppState } from '../../core/state/app-state';
import { ThemedPipe } from '../../core/theme/theme';

export const CATEGORY_ICONS = [
  'translate', 'public', 'palette', 'science', 'calculate', 'menu_book', 'history_edu',
  'music_note', 'sports_soccer', 'computer', 'psychology', 'eco', 'language', 'star',
];
/** Colour-blind-checked chart palette, in order: each category keeps its colour in every chart. */
export const CATEGORY_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

@Component({
  selector: 'app-categories',
  imports: [
    ThemedPipe,
    FormsModule,
    NgTemplateOutlet,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './categories.html',
  styleUrl: './categories.scss',
})
export class Categories {
  protected readonly state = inject(AppState);
  private readonly snack = inject(MatSnackBar);
  protected readonly icons = CATEGORY_ICONS;
  protected readonly colors = CATEGORY_COLORS;

  protected readonly adding = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected draft = { name: '', icon: CATEGORY_ICONS[0], color: CATEGORY_COLORS[0] };
  protected newSubject: Record<string, string> = {};

  protected startAdd() {
    this.editingId.set(null);
    const used = new Set(this.state.categories().map((c) => c.color));
    const color = CATEGORY_COLORS.find((c) => !used.has(c)) ?? CATEGORY_COLORS[0];
    this.draft = { name: '', icon: CATEGORY_ICONS[5], color };
    this.adding.set(true);
  }

  protected startEdit(c: Category) {
    this.adding.set(false);
    this.draft = { name: c.name, icon: c.icon, color: c.color };
    this.editingId.set(c.id);
  }

  protected cancel() {
    this.adding.set(false);
    this.editingId.set(null);
  }

  protected async save() {
    const name = this.draft.name.trim();
    if (!name) return;
    const id = this.editingId();
    await this.run(
      () =>
        id
          ? this.state.updateCategory(id, { name, icon: this.draft.icon, color: this.draft.color })
          : this.state.addCategory(name, this.draft.icon, this.draft.color),
      id ? 'Category updated' : 'Category added',
    );
    this.cancel();
  }

  protected async remove(c: Category) {
    if (!confirm(`Delete the category "${c.name}"?`)) return;
    await this.run(() => this.state.deleteCategory(c.id), 'Category deleted');
  }

  protected async addSubject(c: Category) {
    const name = this.newSubject[c.id]?.trim();
    if (!name) return;
    this.newSubject[c.id] = '';
    await this.run(() => this.state.addSubject(c.id, name), `Subject "${name}" added`);
  }

  protected async renameSubject(c: Category, s: Subject) {
    const name = prompt('Rename subject', s.name)?.trim();
    if (!name || name === s.name) return;
    await this.run(() => this.state.renameSubject(c.id, s.id, name), 'Subject renamed');
  }

  protected async removeSubject(c: Category, s: Subject) {
    if (!confirm(`Delete the subject "${s.name}"?`)) return;
    await this.run(() => this.state.deleteSubject(c.id, s.id), 'Subject deleted');
  }

  private async run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      this.snack.open(success, undefined, { duration: 2000 });
    } catch (e) {
      this.snack.open((e as Error).message, 'OK', { duration: 5000 });
    }
  }
}
