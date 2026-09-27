import { Component, input } from '@angular/core';

/**
 * The app mark: a gradient tile with a check inside a page. The gradient is CSS, not an
 * SVG <linearGradient>, because url(#id) references break under a <base href> subpath.
 */
@Component({
  selector: 'app-logo',
  template: `
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="13" y="10" width="22" height="28" rx="5" fill="none" stroke="#fff" stroke-width="3" opacity="0.55" />
      <path d="M17 25.5l5 5 10-11" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,
  host: { '[style.--size.px]': 'size()' },
  styles: `
    :host {
      --size: 36px;
      display: inline-flex;
      flex-shrink: 0;
      width: var(--size);
      height: var(--size);
      border-radius: calc(var(--size) * 0.29);
      background: var(--app-gradient);
    }
    svg { width: 100%; height: 100%; }
  `,
})
export class Logo {
  readonly size = input(36);
}
