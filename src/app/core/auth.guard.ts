import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Infrastructure } from './infrastructure/infrastructure';

/** Waits for Firebase to restore the saved session, then requires a signed-in member. */
export const authGuard: CanActivateFn = async () => {
  const infra = inject(Infrastructure);
  const router = inject(Router);
  await infra.authReady();
  return infra.isSignedIn() ? true : router.createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = async () => {
  const infra = inject(Infrastructure);
  const router = inject(Router);
  await infra.authReady();
  return infra.isSignedIn() ? router.createUrlTree(['/']) : true;
};
