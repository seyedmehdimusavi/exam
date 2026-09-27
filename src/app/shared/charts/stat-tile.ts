import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** A single headline number with a label and optional note. */
@Component({
  selector: 'app-stat-tile',
  imports: [MatIconModule],
  template: `
    <div class="label"><mat-icon>{{ icon() }}</mat-icon>{{ label() }}</div>
    <div class="value">{{ value() }}</div>
    @if (note()) {
      <div class="note" [class.up]="trend() === 'up'" [class.down]="trend() === 'down'">
        @if (trend() === 'up') { <mat-icon inline>trending_up</mat-icon> }
        @if (trend() === 'down') { <mat-icon inline>trending_down</mat-icon> }
        {{ note() }}
      </div>
    }
  `,
  styles: `
    :host {
      display: flex; flex-direction: column; gap: 4px; padding: 16px;
      border-radius: 16px; background: var(--app-panel);
      border: 1px solid var(--app-border); min-width: 0;
    }
    .label { display: flex; align-items: center; gap: 6px; font: var(--mat-sys-label-large); color: var(--mat-sys-on-surface-variant); }
    .label mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .value { font: 600 32px/1.1 var(--mat-sys-body-large-font, "Plus Jakarta Sans", sans-serif); color: var(--mat-sys-on-surface); }
    .note { font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); }
    .note.up { color: var(--ok-fg); }
    .note.down { color: var(--viz-critical); }
  `,
})
export class StatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input('insights');
  readonly note = input<string>('');
  readonly trend = input<'up' | 'down' | null>(null);
}
