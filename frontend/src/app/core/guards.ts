import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './models';

/** Only logged-in users may open the page. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);
};

/** Login / register pages are not shown to users who are already logged in. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? inject(Router).createUrlTree(['/dashboard']) : true;
};

/** Only the given roles may open the page (the backend checks the role again for every API call). */
export const roleGuard =
  (...roles: Role[]): CanActivateFn =>
  () => {
    const role = inject(AuthService).role();
    return role && roles.includes(role) ? true : inject(Router).createUrlTree(['/dashboard']);
  };
