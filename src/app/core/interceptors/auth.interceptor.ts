import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import {BehaviorSubject, Observable, take, throwError} from 'rxjs';
import {catchError, filter, switchMap} from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import {ApiResponse} from '../models/api-response.model';
import {LoginResponse} from '../../features/user-profile/dto/response/LoginResponse';

// Biến và Subject cho logic refresh token, đặt bên ngoài hàm interceptor chính
let refreshTokenInProgress = false;
const refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null); // Kiểu string | null

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {

  const authService = inject(AuthService);

  const authToken = authService.getAccessToken();

  let authReq = req;


  // Danh sách các URL không cần đính kèm access token
  const urlsNotRequiringToken = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh-token',
    '/api/auth/verify',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/oauth2/google/verify'
  ];


  // Kiểm tra xem URL hiện tại có nằm trong danh sách không cần token không
  const requiresTokenAttachment = authToken && !urlsNotRequiringToken.some(url => req.url.includes(url));

  if (requiresTokenAttachment) {
    authReq = addTokenHeader(req, authToken);
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 &&
        !urlsNotRequiringToken.some(url => authReq.url.includes(url)) && // Không refresh cho các URL này
        !authService.isLoggingOut()) { // Kiểm tra cờ isLoggingOut từ AuthService
        return handleTokenRefresh(authReq, next, authService);
      }
      // Đối với các lỗi khác hoặc nếu không phải 401, ném lỗi để component xử lý
      return throwError(() => error);
    })
  );
};

// Tách hàm thêm token ra ngoài để dễ sử dụng lại
function addTokenHeader(request: HttpRequest<any>, token: string) {
  return request.clone({ headers: request.headers.set('Authorization', 'Bearer ' + token) });
}

function handleTokenRefresh(request: HttpRequest<any>, next: HttpHandlerFn, authService: AuthService): Observable<HttpEvent<any>> {
  if (authService.isLoggingOut()) { // Kiểm tra lại cờ isLoggingOut
    console.log("AuthInterceptor: Logout in progress, aborting token refresh for 401 error.");
    return throwError(() => new HttpErrorResponse({ error: { message: "Logout in progress." }, status: 401, statusText: "Unauthorized" }));
  }

  if (!refreshTokenInProgress) {
    refreshTokenInProgress = true;
    refreshTokenSubject.next(null);

    return authService.attemptRefreshToken().pipe(
      switchMap((tokenResponse: ApiResponse<LoginResponse>) => {
        refreshTokenInProgress = false;
        if (tokenResponse.success && tokenResponse.data?.accessToken) {
          refreshTokenSubject.next(tokenResponse.data.accessToken);
          return next(addTokenHeader(request, tokenResponse.data.accessToken));
        } else {
          // authService.logout(); // AuthService.attemptRefreshToken đã xử lý logout nếu cần
          const errorMessage = tokenResponse.message || "Session expired or refresh failed. Please login again.";
          // Ném lỗi 401 để AuthService.handleError có thể bắt và xử lý
          return throwError(() => new HttpErrorResponse({ error: { message: errorMessage }, status: 401, statusText: "Unauthorized" }));
        }
      }),
      catchError((refreshError) => {
        refreshTokenInProgress = false;

        return throwError(() => refreshError); // Ném lỗi gốc từ attemptRefreshToken
      })
    );
  } else {
    return refreshTokenSubject.pipe(
      filter(token => token != null),
      take(1),
      switchMap(newAccessToken => next(addTokenHeader(request, newAccessToken!))) // Thêm ! vì filter đã đảm bảo không null
    );
  }
}



function handle401Error(request: HttpRequest<any>, next: HttpHandlerFn, authService: AuthService): Observable<HttpEvent<any>> {



  if (!refreshTokenInProgress) {
    refreshTokenInProgress = true;
    refreshTokenSubject.next(null); // Đặt lại subject

    return authService.attemptRefreshToken().pipe(
      switchMap((tokenResponse: ApiResponse<LoginResponse>) => {
        refreshTokenInProgress = false;
        if (tokenResponse.success && tokenResponse.data?.accessToken) {
          refreshTokenSubject.next(tokenResponse.data.accessToken);
          return next(addTokenHeader(request, tokenResponse.data.accessToken)); // Thử lại request gốc với token mới
        } else {
          // Nếu attemptRefreshToken không thành công (ví dụ: refresh token cũng hết hạn)
          authService.logout(); // Logout người dùng
          return throwError(() => new Error("Session expired. Please login again.")); // Ném lỗi mới
        }
      }),
      catchError((err) => {
        refreshTokenInProgress = false;
        authService.logout(); // Logout nếu có lỗi trong quá trình refresh
        return throwError(() => err); // Ném lỗi gốc từ attemptRefreshToken
      })
    );
  } else {
    // Nếu đang có một quá trình refresh token khác diễn ra, đợi nó hoàn thành
    return refreshTokenSubject.pipe(
      filter(token => token != null), // Chờ đến khi refreshTokenSubject có giá trị token mới
      take(1), // Chỉ lấy giá trị đầu tiên
      switchMap(jwt => next(addTokenHeader(request, jwt))) // Thử lại request với token mới
    );
  }
}
