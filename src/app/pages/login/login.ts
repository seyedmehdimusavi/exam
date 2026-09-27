import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Infrastructure } from '../../core/infrastructure/infrastructure';
import { FamilyMember } from '../../core/models/models';
import { AppState } from '../../core/state/app-state';
import { ThemeService, themeIcon } from '../../core/theme/theme';
import { Avatar } from '../../shared/avatar';
import { Logo } from '../../shared/logo';

@Component({
  selector: 'app-login',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, Avatar, Logo],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly state = inject(AppState);
  private readonly router = inject(Router);
  protected readonly configured = inject(Infrastructure).isConfigured;
  protected readonly theme = inject(ThemeService);
  protected readonly themeIcon = computed(() => themeIcon(this.theme.mode()));

  protected readonly members = environment.family.filter((m) => m.email);
  protected readonly pinLength = environment.pinLength;
  protected readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  protected readonly selected = signal<FamilyMember | null>(null);
  protected readonly pin = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dots = computed(() =>
    Array.from({ length: this.pinLength }, (_, i) => i < this.pin().length),
  );

  protected choose(member: FamilyMember) {
    this.selected.set(member);
    this.pin.set('');
    this.error.set(null);
  }

  protected back() {
    this.selected.set(null);
    this.pin.set('');
    this.error.set(null);
  }

  protected press(digit: string) {
    if (this.busy() || this.pin().length >= this.pinLength) return;
    this.error.set(null);
    this.pin.update((p) => p + digit);
    if (this.pin().length === this.pinLength) this.submit();
  }

  protected erase() {
    if (!this.busy()) this.pin.update((p) => p.slice(0, -1));
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent) {
    if (!this.selected()) return;
    if (/^\d$/.test(event.key)) this.press(event.key);
    else if (event.key === 'Backspace') this.erase();
    else if (event.key === 'Escape') this.back();
  }

  private async submit() {
    const member = this.selected();
    if (!member) return;
    this.busy.set(true);
    try {
      await this.state.signIn(member.email, this.pin());
      await this.router.navigateByUrl('/');
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      this.error.set(
        code === 'auth/too-many-requests'
          ? 'Too many tries. Please wait a few minutes.'
          : code === 'auth/network-request-failed'
            ? 'No internet connection.'
            : 'Wrong PIN. Try again.',
      );
      this.pin.set('');
    } finally {
      this.busy.set(false);
    }
  }
}
