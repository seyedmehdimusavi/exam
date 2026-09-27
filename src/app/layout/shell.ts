import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { AppState } from '../core/state/app-state';
import { ThemeService, themeIcon } from '../core/theme/theme';
import { Avatar } from '../shared/avatar';
import { Logo } from '../shared/logo';

export const NAV_ITEMS = [
  { path: 'today', label: 'Today', icon: 'today' },
  { path: 'create-question', label: 'Create Question', icon: 'edit_note' },
  { path: 'upload', label: 'Upload', icon: 'upload_file' },
  { path: 'exams', label: 'Exams', icon: 'quiz' },
  { path: 'progress', label: 'Progress', icon: 'trending_up' },
  { path: 'report', label: 'Report', icon: 'assessment' },
  { path: 'categories', label: 'Categories', icon: 'category' },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatSidenavModule, MatIconModule, MatButtonModule, Avatar, Logo],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly state = inject(AppState);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);
  protected readonly themeIcon = computed(() => themeIcon(this.theme.mode()));
  protected readonly nav = NAV_ITEMS;
  protected readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 800px)')
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  protected async signOut() {
    await this.state.signOut();
    await this.router.navigateByUrl('/login');
  }
}
