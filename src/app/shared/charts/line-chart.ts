import { DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';

export interface LinePoint {
  time: number;
  /** 0–100 */
  value: number;
  title: string;
  subtitle?: string;
}

const PAD = { top: 16, right: 44, bottom: 28, left: 36 };
const HEIGHT = 220;

/**
 * Score % over time. A crosshair snaps to the nearest result; arrow keys do the same
 * when the chart has focus. A hidden table carries every value for screen readers.
 */
@Component({
  selector: 'app-line-chart',
  imports: [DatePipe],
  template: `
    <svg
      [attr.width]="width()"
      [attr.height]="height"
      tabindex="0"
      role="img"
      [attr.aria-label]="caption()"
      (pointermove)="onPointer($event)"
      (pointerleave)="active.set(null)"
      (keydown)="onKey($event)"
      (blur)="active.set(null)"
    >
      @for (t of ticks; track t) {
        <line class="grid" [attr.x1]="pad.left" [attr.x2]="width() - pad.right" [attr.y1]="y(t)" [attr.y2]="y(t)" />
        <text class="tick" [attr.x]="pad.left - 8" [attr.y]="y(t) + 4" text-anchor="end">{{ t }}%</text>
      }
      @for (label of xLabels(); track label.x) {
        <text class="tick" [attr.x]="label.x" [attr.y]="height - 8" [attr.text-anchor]="label.anchor">{{ label.text }}</text>
      }
      @if (points().length > 1) {
        <path class="area" [attr.d]="areaPath()" />
        <path class="line" [attr.d]="linePath()" />
      }
      @if (active() !== null) {
        <line class="cross" [attr.x1]="x(points()[active()!].time)" [attr.x2]="x(points()[active()!].time)" [attr.y1]="pad.top" [attr.y2]="height - pad.bottom" />
      }
      @for (p of points(); track $index; let i = $index) {
        <circle class="dot" [class.on]="active() === i" [attr.cx]="x(p.time)" [attr.cy]="y(p.value)" [attr.r]="active() === i ? 6 : 4" />
      }
      @if (last(); as p) {
        <text class="end" [attr.x]="x(p.time) + 10" [attr.y]="y(p.value) + 4">{{ p.value }}%</text>
      }
    </svg>

    @if (active() !== null) {
      @let p = points()[active()!];
      <div class="tip" [style.left.px]="tipLeft()" [style.top.px]="y(p.value)">
        <b>{{ p.value }}%</b>
        <span>{{ p.title }}</span>
        <small>{{ p.time | date: 'EEE d MMM, HH:mm' }}{{ p.subtitle ? ' · ' + p.subtitle : '' }}</small>
      </div>
    }

    <table class="visually-hidden">
      <caption>{{ caption() }}</caption>
      <tr><th>Date</th><th>Exam</th><th>Score</th></tr>
      @for (p of points(); track $index) {
        <tr><td>{{ p.time | date: 'd MMM y' }}</td><td>{{ p.title }}</td><td>{{ p.value }}%</td></tr>
      }
    </table>
  `,
  styles: `
    :host { display: block; position: relative; width: 100%; }
    svg { display: block; outline: none; touch-action: pan-y; }
    svg:focus-visible { outline: 2px solid var(--mat-sys-primary); outline-offset: 2px; border-radius: 8px; }
    .grid { stroke: var(--viz-grid); stroke-width: 1; }
    .tick { font: 11px "Plus Jakarta Sans", sans-serif; fill: var(--viz-muted); font-variant-numeric: tabular-nums; }
    .line { fill: none; stroke: var(--viz-series-1); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    .area { fill: var(--viz-series-1); opacity: 0.1; }
    .cross { stroke: var(--viz-axis); stroke-width: 1; }
    .dot { fill: var(--viz-series-1); stroke: var(--viz-surface); stroke-width: 2; }
    .end { font: 500 12px "Plus Jakarta Sans", sans-serif; fill: var(--mat-sys-on-surface); }
    .tip {
      position: absolute; transform: translate(-50%, calc(-100% - 12px)); pointer-events: none;
      display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; border-radius: 10px; max-width: 220px;
      background: var(--mat-sys-inverse-surface); color: var(--mat-sys-inverse-on-surface); box-shadow: var(--mat-sys-level2);
    }
    .tip b { font: var(--mat-sys-title-medium); }
    .tip span { font: var(--mat-sys-body-small); }
    .tip small { font: 11px "Plus Jakarta Sans", sans-serif; opacity: 0.8; }
  `,
})
export class LineChart {
  readonly points = input.required<LinePoint[]>();
  readonly caption = input('Scores over time');

  protected readonly pad = PAD;
  protected readonly height = HEIGHT;
  protected readonly ticks = [0, 25, 50, 75, 100];
  protected readonly width = signal(600);
  protected readonly active = signal<number | null>(null);

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) => this.width.set(Math.max(280, entry.contentRect.width)));
      observer.observe(this.host.nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private readonly domain = computed(() => {
    const times = this.points().map((p) => p.time);
    const min = Math.min(...times);
    const max = Math.max(...times);
    return min === max ? { min: min - 43_200_000, max: max + 43_200_000 } : { min, max };
  });

  protected x(time: number) {
    const { min, max } = this.domain();
    return PAD.left + ((time - min) / (max - min)) * (this.width() - PAD.left - PAD.right);
  }

  protected y(value: number) {
    return PAD.top + (1 - value / 100) * (HEIGHT - PAD.top - PAD.bottom);
  }

  protected readonly last = computed(() => this.points().at(-1));

  protected readonly linePath = computed(() =>
    this.points().map((p, i) => `${i ? 'L' : 'M'}${this.x(p.time)},${this.y(p.value)}`).join(' '),
  );
  protected readonly areaPath = computed(() => {
    const pts = this.points();
    const base = this.y(0);
    return `${this.linePath()} L${this.x(pts.at(-1)!.time)},${base} L${this.x(pts[0].time)},${base} Z`;
  });

  protected readonly xLabels = computed(() => {
    const pts = this.points();
    if (!pts.length) return [];
    const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const first = { x: this.x(pts[0].time), text: fmt(pts[0].time), anchor: 'start' };
    if (pts.length === 1) return [{ ...first, anchor: 'middle' }];
    return [first, { x: this.x(pts.at(-1)!.time), text: fmt(pts.at(-1)!.time), anchor: 'end' }];
  });

  protected tipLeft() {
    const i = this.active();
    if (i === null) return 0;
    return Math.min(this.width() - 110, Math.max(110, this.x(this.points()[i].time)));
  }

  protected onPointer(event: PointerEvent) {
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
    const px = event.clientX - rect.left;
    let best = 0;
    this.points().forEach((p, i) => {
      if (Math.abs(this.x(p.time) - px) < Math.abs(this.x(this.points()[best].time) - px)) best = i;
    });
    this.active.set(this.points().length ? best : null);
  }

  protected onKey(event: KeyboardEvent) {
    const n = this.points().length;
    if (!n) return;
    const current = this.active() ?? n;
    if (event.key === 'ArrowLeft') this.active.set(Math.max(0, current - 1));
    else if (event.key === 'ArrowRight') this.active.set(Math.min(n - 1, (this.active() ?? -1) + 1));
    else return;
    event.preventDefault();
  }
}
