import { Component, computed, input } from '@angular/core';

const HUES = [265, 200, 330, 160, 25, 225, 290, 180];

/** Initials in a gradient circle; the colour is stable per person. */
@Component({
  selector: 'app-avatar',
  template: `{{ initials() }}`,
  host: {
    '[style.--size.px]': 'size()',
    '[style.--hue]': 'hue()',
    '[attr.title]': 'name()',
    'aria-hidden': 'true',
  },
  styles: `
    :host {
      --size: 32px;
      width: var(--size);
      height: var(--size);
      flex-shrink: 0;
      display: inline-grid;
      place-items: center;
      border-radius: 50%;
      font: 700 calc(var(--size) * 0.38) / 1 'Plus Jakarta Sans', sans-serif;
      letter-spacing: 0.02em;
      color: #fff;
      background: linear-gradient(135deg, hsl(var(--hue) 75% 58%), hsl(calc(var(--hue) + 40) 70% 45%));
      user-select: none;
    }
  `,
})
export class Avatar {
  readonly name = input.required<string>();
  /** Used for the colour so two people with the same initials still differ. */
  readonly seed = input('');
  readonly size = input(32);

  protected readonly initials = computed(() => {
    const words = this.name().replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
    const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2);
    return letters.toUpperCase();
  });

  protected readonly hue = computed(() => {
    const text = this.seed() || this.name();
    let hash = 0;
    for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return HUES[hash % HUES.length];
  });
}
