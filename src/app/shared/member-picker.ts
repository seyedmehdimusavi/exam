import { Component, inject, input, model, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../environments/environment';
import { AppState } from '../core/state/app-state';
import { Avatar } from './avatar';

/**
 * Chips to choose whose activity a dashboard shows. The choice is remembered on this
 * device, so a parent who picks their son once sees him by default next time.
 */
@Component({
  selector: 'app-member-picker',
  imports: [MatIconModule, Avatar],
  template: `
    @if (allowEveryone()) {
      <button class="chip" [class.on]="!email()" (click)="pick('')"><mat-icon>groups</mat-icon> Everyone</button>
    }
    @for (m of family; track m.email) {
      <button class="chip" [class.on]="email() === m.email" (click)="pick(m.email)"><app-avatar [name]="m.name" [seed]="m.email" [size]="22" /> {{ m.name }}</button>
    }
  `,
  styles: `
    :host { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px 5px 6px; border-radius: 20px; border: 1px solid var(--app-border);
      background: transparent; color: var(--mat-sys-on-surface); font: var(--mat-sys-label-large); cursor: pointer;
    }
    .chip mat-icon { font-size: 20px; width: 22px; height: 20px; text-align: center; }
    .chip.on { background: color-mix(in srgb, var(--mat-sys-primary) 14%, transparent); border-color: var(--mat-sys-primary); }
  `,
})
export class MemberPicker implements OnInit {
  private readonly state = inject(AppState);
  protected readonly family = environment.family.filter((m) => m.email);

  /** '' means everyone. */
  readonly email = model('');
  readonly allowEveryone = input(true);

  private static readonly KEY = 'dashboard-member';

  ngOnInit() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(MemberPicker.KEY);
    } catch {
      // storage unavailable; fall back to the signed-in member
    }
    const valid = saved !== null && (saved === '' ? this.allowEveryone() : this.family.some((m) => m.email === saved));
    this.email.set(valid ? saved! : (this.state.currentUser()?.email ?? ''));
  }

  protected pick(email: string) {
    this.email.set(email);
    try {
      localStorage.setItem(MemberPicker.KEY, email);
    } catch {
      // ignore
    }
  }
}
