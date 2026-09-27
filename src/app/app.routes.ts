import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'today' },
      { path: 'today', loadComponent: () => import('./pages/today/today').then((m) => m.Today) },
      {
        path: 'create-question',
        loadComponent: () => import('./pages/create-question/create-question').then((m) => m.CreateQuestion),
      },
      { path: 'upload', loadComponent: () => import('./pages/upload/upload').then((m) => m.Upload) },
      { path: 'exams', loadComponent: () => import('./pages/exams/exams').then((m) => m.Exams) },
      { path: 'exams/new', loadComponent: () => import('./pages/exams/exam-builder').then((m) => m.ExamBuilder) },
      { path: 'exams/:id/edit', loadComponent: () => import('./pages/exams/exam-builder').then((m) => m.ExamBuilder) },
      { path: 'exams/:id/take', loadComponent: () => import('./pages/exams/take-exam').then((m) => m.TakeExam) },
      { path: 'attempts/:id', loadComponent: () => import('./pages/exams/attempt-review').then((m) => m.AttemptReview) },
      { path: 'progress', loadComponent: () => import('./pages/progress/progress').then((m) => m.Progress) },
      { path: 'report', loadComponent: () => import('./pages/report/report').then((m) => m.Report) },
      {
        path: 'categories',
        loadComponent: () => import('./pages/categories/categories').then((m) => m.Categories),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
