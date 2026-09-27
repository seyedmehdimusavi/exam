import { Component, computed, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface ColumnSeries {
  name: string;
  color: string;
}

export interface Column {
  label: string;
  /** One value per series, same order as `series`. */
  values: number[];
  highlight?: boolean;
}

/** Stacked columns over a few periods (e.g. the last 7 days), with a data table for screen readers. */
@Component({
  selector: 'app-column-chart',
  imports: [MatTooltipModule],
  template: `
    @if (series().length > 1) {
      <div class="legend">
        @for (s of series(); track s.name) {
          <span><i [style.background]="s.color"></i>{{ s.name }}</span>
        }
      </div>
    }
    <div class="plot" aria-hidden="true">
      <div class="grid">
        @for (t of ticks(); track t) {
          <div class="tick" [style.bottom.%]="(t / top()) * 100"><span>{{ t }}</span></div>
        }
      </div>
      <div class="cols">
        @for (c of columns(); track c.label) {
          <div class="col" [matTooltip]="tooltip(c)" matTooltipPosition="above">
            <div class="stack" [style.height.%]="(sum(c) / top()) * 100">
              @for (v of c.values; track $index; let i = $index) {
                @if (v > 0) {
                  <span class="seg" [style.flex-grow]="v" [style.background]="series()[i].color"></span>
                }
              }
            </div>
            @if (c.highlight && sum(c) > 0) {
              <span class="cap" [style.bottom.%]="(sum(c) / top()) * 100">{{ sum(c) }}</span>
            }
          </div>
        }
      </div>
    </div>
    <div class="labels" aria-hidden="true">
      @for (c of columns(); track c.label) {
        <span [class.strong]="c.highlight">{{ c.label }}</span>
      }
    </div>
    <table class="visually-hidden">
      <caption>{{ caption() }}</caption>
      <tr><th>Period</th>@for (s of series(); track s.name) { <th>{{ s.name }}</th> }</tr>
      @for (c of columns(); track c.label) {
        <tr><td>{{ c.label }}</td>@for (v of c.values; track $index) { <td>{{ v }}</td> }</tr>
      }
    </table>
  `,
  styles: `
    :host { display: block; position: relative; }
    .legend { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 12px; font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); }
    .legend span { display: flex; align-items: center; gap: 6px; }
    .legend i { width: 12px; height: 12px; border-radius: 3px; }
    .plot { position: relative; height: 180px; margin-left: 28px; border-bottom: 1px solid var(--viz-axis); }
    .grid { position: absolute; inset: 0; }
    .tick { position: absolute; left: 0; right: 0; border-top: 1px solid var(--viz-grid); }
    .tick span { position: absolute; left: -28px; width: 22px; top: -8px; text-align: right; font: 11px/16px "Plus Jakarta Sans", sans-serif; color: var(--viz-muted); font-variant-numeric: tabular-nums; }
    .cols { position: absolute; inset: 0; display: flex; }
    .col { position: relative; flex: 1; display: flex; align-items: flex-end; justify-content: center; cursor: default; }
    .col:hover { background: color-mix(in srgb, var(--mat-sys-on-surface) 4%, transparent); }
    .stack { width: min(24px, 60%); display: flex; flex-direction: column-reverse; gap: 2px; border-radius: 4px 4px 0 0; overflow: hidden; }
    .seg { flex-basis: 0; min-height: 2px; }
    .cap { position: absolute; transform: translateY(-4px); font: var(--mat-sys-label-medium); color: var(--mat-sys-on-surface); }
    .labels { display: flex; margin-left: 28px; margin-top: 6px; }
    .labels span { flex: 1; text-align: center; font: 11px/16px "Plus Jakarta Sans", sans-serif; color: var(--viz-muted); }
    .labels .strong { color: var(--mat-sys-on-surface); font-weight: 500; }
  `,
})
export class ColumnChart {
  readonly series = input.required<ColumnSeries[]>();
  readonly columns = input.required<Column[]>();
  readonly caption = input('');

  private readonly maxSum = computed(() => Math.max(0, ...this.columns().map((c) => this.sum(c))));
  /** A clean axis top: 4, 8, 10, 20, 40, 50, 100… */
  protected readonly top = computed(() => niceMax(this.maxSum()));
  protected readonly ticks = computed(() => {
    const top = this.top();
    const step = top / 4;
    return [0, step, step * 2, step * 3, top].filter((t) => Number.isInteger(t));
  });

  protected sum(c: Column) {
    return c.values.reduce((s, v) => s + v, 0);
  }

  protected tooltip(c: Column) {
    return `${c.label}: ` + this.series().map((s, i) => `${c.values[i]} ${s.name.toLowerCase()}`).join(' · ');
  }
}

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const m of [1, 2, 4, 5, 8, 10]) if (m * magnitude >= value) return m * magnitude;
  return 10 * magnitude;
}
