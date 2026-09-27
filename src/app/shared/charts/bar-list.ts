import { Component, computed, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface BarPart {
  name: string;
  value: number;
  color: string;
}

export interface BarItem {
  id: string;
  label: string;
  /** Swatch colour identifying the row (e.g. its category). */
  color?: string;
  parts: BarPart[];
  /** Text at the bar tip; defaults to the total. */
  display?: string;
  note?: string;
}

/**
 * Horizontal bars, one row per item, optionally split into stacked parts.
 * Labels and values are always visible text, so colour is never the only cue.
 */
@Component({
  selector: 'app-bar-list',
  imports: [MatTooltipModule],
  template: `
    @if (legend().length > 1) {
      <div class="legend">
        @for (l of legend(); track l.name) {
          <span><i [style.background]="l.color"></i>{{ l.name }}</span>
        }
      </div>
    }
    @for (item of items(); track item.id) {
      <div class="row" tabindex="0" [matTooltip]="tooltip(item)" matTooltipPosition="above">
        <span class="label">
          @if (item.color) { <i class="swatch" [style.background]="item.color"></i> }
          <span class="text">{{ item.label }}</span>
        </span>
        <span class="track">
          <span class="bar" [style.width.%]="(total(item) / scale()) * 100">
            @for (p of item.parts; track p.name) {
              @if (p.value > 0) {
                <span class="seg" [style.flex-grow]="p.value" [style.background]="p.color"></span>
              }
            }
          </span>
          <span class="value">{{ item.display ?? total(item) }}</span>
        </span>
      </div>
    } @empty {
      <p class="empty">{{ emptyText() }}</p>
    }
  `,
  styles: `
    :host { display: block; }
    .legend { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 8px; font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); }
    .legend span { display: flex; align-items: center; gap: 6px; }
    .legend i { width: 12px; height: 12px; border-radius: 3px; }
    .row { display: grid; grid-template-columns: minmax(90px, 32%) 1fr; align-items: center; gap: 12px; padding: 6px 4px; border-radius: 8px; outline: none; }
    .row:hover, .row:focus-visible { background: var(--mat-sys-surface-container); }
    .label { display: flex; align-items: center; gap: 8px; min-width: 0; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface); }
    .text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .swatch { flex-shrink: 0; width: 10px; height: 10px; border-radius: 50%; }
    .track { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .bar { display: flex; gap: 2px; height: 16px; min-width: 0; border-radius: 0 4px 4px 0; overflow: hidden; }
    .seg { flex-basis: 0; min-width: 2px; }
    .value { flex-shrink: 0; font: var(--mat-sys-label-large); font-variant-numeric: tabular-nums; color: var(--mat-sys-on-surface); }
    .empty { color: var(--mat-sys-on-surface-variant); }
  `,
})
export class BarList {
  readonly items = input.required<BarItem[]>();
  /** Fixed scale maximum (e.g. 100 for percentages); defaults to the largest total. */
  readonly max = input<number | null>(null);
  readonly emptyText = input('No data yet.');

  protected readonly scale = computed(() => this.max() ?? Math.max(1, ...this.items().map((i) => this.total(i))));
  protected readonly legend = computed(() => {
    const seen = new Map<string, string>();
    for (const item of this.items()) for (const p of item.parts) if (!seen.has(p.name)) seen.set(p.name, p.color);
    return [...seen].map(([name, color]) => ({ name, color }));
  });

  protected total(item: BarItem) {
    return item.parts.reduce((s, p) => s + p.value, 0);
  }

  protected tooltip(item: BarItem) {
    const parts = item.parts.length > 1 ? item.parts.map((p) => `${p.value} ${p.name}`).join(' · ') : '';
    return [item.label, item.display ?? this.total(item), parts, item.note].filter(Boolean).join(' — ');
  }
}
