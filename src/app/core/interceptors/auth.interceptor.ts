import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {

  const authService = inject(AuthService);
  const router = inject(Router);
  const authToken = authService.getToken();

  // Clone the request and add the authorization header if token exists
  // and the request is not for the auth endpoints themselves
  let authReq = req;
  if (authToken && !req.url.includes('/api/auth/')) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${authToken}`
      }
    });
    // console.debug("AuthInterceptor: Added Bearer token to request for", req.url);
  }

  // Pass the cloned request instead of the original request to the next handle
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle 401 Unauthorized specifically (e.g., invalid/expired token)
      if (error.status === 401 && !router.url.includes('/auth/login')) { // Avoid logout loop on login page
        console.error('AuthInterceptor: Unauthorized (401) error detected. Logging out.', error);
        // Use the injected AuthService to logout and redirect
        authService.logout();
        // Return an observable error to stop further processing in the component
        // Pass the original error or a custom one
        return throwError(() => new Error('Session expired or invalid. Please login again.'));
      }
      // Handle 403 Forbidden (optional, could redirect to unauthorized page)
      else if (error.status === 403) {
        console.error('AuthInterceptor: Forbidden (403) error detected.', error);
        // router.navigate(['/unauthorized']); // Optional redirect
      }

      // Re-throw the error to be caught by other error handlers or the component
      return throwError(() => error); // Ném lại lỗi gốc để AuthService hoặc component xử lý tiếp
    })
  );
};
