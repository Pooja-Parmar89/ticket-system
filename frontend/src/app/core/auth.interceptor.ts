import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { API_URL } from './config';

/** Adds "Authorization: Bearer <jwt>" to every API call and logs the user out when the server says 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;
  const isApi = req.url.startsWith(API_URL);
  const isPublic = req.url.startsWith(`${API_URL}/auth/`);

  const request =
    token && isApi && !isPublic ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isPublic) {
        auth.logout();
      }
      return throwError(() => err);
    }),
  );
};
