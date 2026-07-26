import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

let refreshRequest$: Observable<string> | null = null;

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();
  const authReq = token && !isAuthPublicRequest(req.url) ? withAuthHeader(req, token) : req;

  return next(authReq).pipe(
    catchError((error) => {
      if (error.status !== 401 || isRefreshExcludedRequest(req.url) || !auth.hasRefreshToken()) {
        if (error.status === 401 && !isRefreshExcludedRequest(req.url)) {
          auth.clearSession();
        }
        return throwError(() => error);
      }

      refreshRequest$ ??= auth.refreshToken().pipe(
        shareReplay(1),
        finalize(() => {
          refreshRequest$ = null;
        }),
      );

      return refreshRequest$.pipe(
        switchMap((newToken) => next(withAuthHeader(req, newToken))),
        catchError((refreshError) => {
          auth.clearSession();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

function withAuthHeader(req: HttpRequest<unknown>, token: string) {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function isAuthPublicRequest(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/auth/refresh');
}

function isRefreshExcludedRequest(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout');
}
