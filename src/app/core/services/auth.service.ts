import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError, BehaviorSubject, of } from 'rxjs';
import { catchError, tap, map, switchMap, finalize } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';

import { UserRegistrationRequest } from '../../features/user-profile/dto/request/UserRegistrationRequest';
import { UserLoginRequest } from '../../features/user-profile/dto/request/UserLoginRequest';
import { UserResponse } from '../../features/user-profile/dto/response/UserResponse';
import { LoginResponse } from '../../features/user-profile/dto/response/LoginResponse';
import { ForgotPasswordRequest } from '../../features/user-profile/dto/request/ForgotPasswordRequest';
import { ResetPasswordRequest } from '../../features/user-profile/dto/request/ResetPasswordRequest';
import {UserProfileResponse} from '../../features/user-profile/dto/response/UserProfileResponse';

import {SocialAuthService} from '@abacritt/angularx-social-login';
import {ToastrService} from 'ngx-toastr';
import {RoleType} from '../../common/model/role-type.enum';

const AUTH_TOKEN_KEY = 'authToken';
const REFRESH_TOKEN_KEY = 'refreshToken'; // Key cho refresh token
const CURRENT_USER_KEY = 'currentUser';

// Định nghĩa kiểu cho HttpStatus để dễ sử dụng hơn
enum HttpStatus {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private socialAuthService = inject(SocialAuthService);
  private toastr = inject(ToastrService);


  private apiUrl = `${environment.apiUrl}/auth`;
  private userApiUrl = `${environment.apiUrl}/users`;

  // --- State Management với Signals ---
  private authTokenSignal = signal<string | null>(this.getTokenFromStorage(AUTH_TOKEN_KEY));
  private refreshTokenSignal = signal<string | null>(this.getTokenFromStorage(REFRESH_TOKEN_KEY)); // Signal cho refresh token
  private currentUserSignal = signal<UserResponse | null>(this.getUserFromStorage());
  private loadingSignal = signal<boolean>(false); // Signal cho trạng thái loading

  private rolesSignal = signal<Set<RoleType>>(new Set(this.getUserFromStorage()?.roles as RoleType[] || [])); // <<  SIGNAL CHO ROLES

  // Public signals
  public readonly currentToken = this.authTokenSignal.asReadonly();
  public readonly currentUser = this.currentUserSignal.asReadonly();
  public readonly isAuthenticated = computed(() => !!this.authTokenSignal());
  public readonly isLoading = this.loadingSignal.asReadonly();
  public readonly roles = this.rolesSignal.asReadonly(); // << PUBLIC READONLY SIGNAL CHO ROLES

  // --- REFRESH TOKEN LOGIC ---
  private refreshTokenInProgress = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  // ---------------------------

  public readonly isLoggingOut = signal(false);

  constructor() {
    // Effect để lưu vào localStorage
    effect(() => {
      const accessToken = this.authTokenSignal();
      const refreshToken = this.refreshTokenSignal(); // Lấy refresh token
      const user = this.currentUserSignal();
      if (typeof localStorage !== 'undefined') {
        if (accessToken) {
          localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
        } else {
          localStorage.removeItem(AUTH_TOKEN_KEY);
        }
        if (refreshToken) { // LƯU REFRESH TOKEN
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        } else {
          localStorage.removeItem(REFRESH_TOKEN_KEY);
        }
        if (user) {
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        } else {
          localStorage.removeItem(CURRENT_USER_KEY);
        }
      }
    }, { allowSignalWrites: true }); // Cần thiết nếu effect ghi lại signal khác
  }

  // --- Lấy dữ liệu từ localStorage ---
  private getTokenFromStorage(key: string): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(key);
    }
    return null;
  }

  private getUserFromStorage(): UserResponse | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      const userJson = localStorage.getItem(CURRENT_USER_KEY);
      try {
        return userJson ? JSON.parse(userJson) : null;
      } catch (e) {
        console.error("Error parsing user data from localStorage", e);
        localStorage.removeItem(CURRENT_USER_KEY);
        return null;
      }
    }
    return null;
  }

  // --- API Calls ---

  register(data: UserRegistrationRequest): Observable<ApiResponse<UserResponse>> {
    this.loadingSignal.set(true);
    return this.http.post<ApiResponse<UserResponse>>(`${this.apiUrl}/register`, data)
      .pipe(
        catchError(this.handleError.bind(this)), // Bind this cho handleError
        finalize(() => this.loadingSignal.set(false)) // Luôn tắt loading khi hoàn thành/lỗi
      );
  }

  verifyEmail(token: string): Observable<ApiResponse<void>> {
    this.loadingSignal.set(true);
    return this.http.get<ApiResponse<void>>(`${this.apiUrl}/verify`, { params: { token } })
      .pipe(
        catchError(this.handleError.bind(this)),
        finalize(() => this.loadingSignal.set(false))
      );
  }

  login(data: UserLoginRequest): Observable<ApiResponse<LoginResponse>> {
    this.loadingSignal.set(true);
    return this.http.post<ApiResponse<LoginResponse>>(`${this.apiUrl}/login`, data)
      .pipe(
        tap(response => {
          if (response.success && response.data) {

            this.setSession(response.data);

          } else {
            // Xử lý trường hợp API trả về success=true nhưng không có data
            this.clearAuthData();
            // Có thể throw lỗi ở đây nếu muốn component xử lý
            throw new Error(response.message || 'Login failed: No data received');
          }
        }),
        catchError(this.handleError.bind(this)),
        finalize(() => this.loadingSignal.set(false))
      );
  }

  forgotPassword(data: ForgotPasswordRequest): Observable<ApiResponse<void>> {
    this.loadingSignal.set(true);
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/forgot-password`, data)
      .pipe(
        catchError(this.handleError.bind(this)),
        finalize(() => this.loadingSignal.set(false))
      );
  }

  resetPassword(data: ResetPasswordRequest): Observable<ApiResponse<void>> {
    this.loadingSignal.set(true);
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/reset-password`, data)
      .pipe(
        catchError(this.handleError.bind(this)),
        finalize(() => this.loadingSignal.set(false))
      );
  }

  logout(): void {

    if (this.isLoggingOut()) return; // Tránh gọi logout nhiều lần nếu đang trong quá trình

    this.isLoggingOut.set(true); // Đặt cờ báo đang logout
    this.loadingSignal.set(true);

    const logoutUrl = `${this.apiUrl}/logout`; // API logout của backend
    const accessToken = this.getAccessToken();
    this.loadingSignal.set(true);

    // Gọi API logout của backend trước khi xóa dữ liệu ở client
    this.http.post<ApiResponse<void>>(logoutUrl, {})
      .pipe(
        finalize(() => { // Luôn clear data và điều hướng dù API logout thành công hay không
        this.performFrontendLogout(); // Gọi hàm logout frontend
        this.loadingSignal.set(false);
        this.isLoggingOut.set(false); // Reset cờ sau khi hoàn tất
      })
    ).subscribe({
      next: (res) => {
        if (res.success) {
          this.toastr.info('Bạn đã đăng xuất thành công.');
          console.log('Server confirmed logout, token blacklisted.');
        } else {
          // API có thể trả về success=false nếu có lỗi nhẹ, nhưng vẫn nên logout ở client
          this.toastr.warning(res.message || 'Đăng xuất khỏi server không hoàn toàn thành công, nhưng bạn đã được đăng xuất khỏi ứng dụng.');
          console.warn('Server logout issue:', res.message);
        }
      },
      error: (err) => {
        // Lỗi mạng hoặc lỗi server nghiêm trọng, nhưng vẫn logout ở client
        this.toastr.error('Có lỗi xảy ra khi đăng xuất khỏi server, nhưng bạn đã được đăng xuất khỏi ứng dụng.');
        console.error('Error during server logout:', err);
      }
    });
  }

  private performFrontendLogout(): void {
    this.socialAuthService.signOut(true) // Thêm true để revoke token nếu có thể
      .then(() => { // Sử dụng .then() để đảm bảo signOut hoàn tất
        console.log('Social sign out successful.');
      })
      .catch(err => {
        console.warn('Error signing out from social provider:', err);
      })
      .finally(() => {
        this.clearAuthData();
        // Chỉ điều hướng nếu không phải đang ở trang login rồi
        if (!this.router.url.includes('/auth/login')) {
          this.router.navigate(['/auth/login']);
        }
        console.log('Local auth data cleared.');
      });
  }




  refreshUserProfile(): Observable<UserResponse | null> {
    if (!this.isAuthenticated()) {
      return of(null); // Trả về observable null nếu chưa đăng nhập
    }
    this.loadingSignal.set(true); // Bật loading khi refresh
    // Gọi API lấy profile đầy đủ
    return this.http.get<ApiResponse<UserProfileResponse>>(`${this.userApiUrl}/me/profile`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            // Chỉ cập nhật phần UserResponse cơ bản vào currentUserSignal
            // Thông tin profile chi tiết (farmer/business) có thể được quản lý riêng nếu cần

            const basicUserInfo: UserResponse = {
              id: response.data.id,
              email: response.data.email,
              fullName: response.data.fullName,
              phoneNumber: response.data.phoneNumber,
              avatarUrl: response.data.avatarUrl,
              roles: response.data.roles,
              active: response.data.active,
              createdAt: response.data.createdAt
            };
            this.currentUserSignal.set(basicUserInfo); // Cập nhật signal
            return basicUserInfo;
          } else {
            console.warn("Failed to refresh user profile:", response.message);
            // Không xóa thông tin cũ nếu API lỗi? Hoặc xóa tùy logic
            // this.clearAuthData();
            return null;
          }
        }),
        catchError(error => {
          console.error("Error refreshing user profile:", error);
          // Không xóa thông tin cũ khi API lỗi
          return of(null); // Trả về observable null khi có lỗi
        }),
        finalize(() => this.loadingSignal.set(false)) // Tắt loading
      );
  }


  loginWithGoogle(idToken: string): Observable<ApiResponse<LoginResponse>> {
    const requestBody = { idToken };
    // Gọi API backend mới tạo
    return this.http.post<ApiResponse<LoginResponse>>(`${this.apiUrl}/oauth2/google/verify`, requestBody)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.setSession(response.data); // Lưu token JWT trả về
            // Không cần load profile ở đây nữa, setSession sẽ làm nếu cần
            // this.loadUserProfile().subscribe();
          } else {
            throw new Error(response.message || 'Google Sign-In failed on backend');
          }
        }),
        // Không cần finalize ở đây vì component sẽ quản lý isLoading
        catchError(this.handleError.bind(this))
      );
  }



  private setSession(authResult: LoginResponse): void {
    if (authResult.accessToken && authResult.refreshToken && authResult.user) {
      this.authTokenSignal.set(authResult.accessToken);
      this.refreshTokenSignal.set(authResult.refreshToken); // LƯU REFRESH TOKEN
      this.currentUserSignal.set(authResult.user);
      // this.isAuthenticated.set(true); // KHÔNG CẦN, computed sẽ tự cập nhật
      this.rolesSignal.set(new Set(authResult.user.roles as RoleType[])); // << CẬP NHẬT ROLES SIGNAL
    } else {
      this.clearAuthData();
    }
  }


  // --- Helper Methods ---

  private clearAuthData(): void {
    this.authTokenSignal.set(null);
    this.refreshTokenSignal.set(null); // XÓA REFRESH TOKEN
    this.currentUserSignal.set(null);
    // this.isAuthenticated.set(false); // KHÔNG CẦN
    this.rolesSignal.set(new Set()); // << RESET ROLES SIGNAL
    // localStorage sẽ được xóa bởi effect
  }

  getAccessToken(): string | null {
    return this.authTokenSignal();
  }
  getRefreshToken(): string | null {
    return this.refreshTokenSignal();
  }


  attemptRefreshToken(): Observable<ApiResponse<LoginResponse>> {

    if (this.isLoggingOut()) { // << NẾU ĐANG LOGOUT, KHÔNG THỬ REFRESH
      return throwError(() => new Error("Logout in progress, refresh token attempt aborted."));
    }

    const rToken = this.getRefreshToken();
    if (!rToken) {
      // Không gọi logout() trực tiếp ở đây nữa để tránh vòng lặp nếu isLoggingOut chưa kịp set
      // Interceptor sẽ xử lý việc logout nếu refresh token không có sẵn
      this.clearAuthData(); // Xóa dữ liệu và để interceptor điều hướng nếu cần
      this.router.navigate(['/auth/login'], { queryParams: { reason: 'no_refresh_token' } });
      return throwError(() => new Error("No refresh token available. Please login."));
    }

    this.refreshTokenInProgress = true; // Đánh dấu đang refresh
    this.loadingSignal.set(true); // Có thể bật loading chung

    // Gửi refresh token dưới dạng plain text string trong body
    // Hoặc nếu backend nhận JSON: return this.http.post<ApiResponse<LoginResponse>>(`${this.apiUrl}/refresh-token`, { refreshToken: rToken })
    return this.http.post<ApiResponse<LoginResponse>>(`${this.apiUrl}/refresh-token`, rToken, {
      headers: new HttpHeaders({ 'Content-Type': 'text/plain' })
    }).pipe(
      tap((response: ApiResponse<LoginResponse>) => {
        if (response.success && response.data) {
          this.setSession(response.data); // Lưu token mới
          this.refreshTokenSubject.next(response.data.accessToken); // Thông báo cho các request đang chờ
        } else {
          // Refresh thất bại, logout sẽ được gọi bởi interceptor hoặc handleError
          // Không gọi logout() trực tiếp ở đây để tránh vòng lặp
          console.warn("Refresh token attempt failed with success=false or no data.");
          this.clearAuthData(); // Xóa token để lần sau không thử refresh nữa
          this.router.navigate(['/auth/login'], { queryParams: { reason: 'refresh_failed' } });
        }
      }),
      catchError(error => {
        // Lỗi khi refresh, logout sẽ được gọi bởi interceptor hoặc handleError
        console.error("Error during attemptRefreshToken API call:", error);
        this.clearAuthData();
        this.router.navigate(['/auth/login'], { queryParams: { reason: 'refresh_error' } });
        return throwError(() => error);
      }),
      finalize(() => {
        this.refreshTokenInProgress = false;
        this.loadingSignal.set(false);
      })
    );
  }


  // Kiểm tra role (dùng cho guard và component logic)
  hasRole(role: string): boolean {
    const user = this.currentUserSignal();
    // Thêm kiểm tra null an toàn
    return this.rolesSignal().has(role as RoleType); // Ép kiểu nếu cần, hoặc đảm bảo role truyền vào là RoleType
  }

  // Signal kiểm tra role (dùng trong template)
  hasRoleSignal(role: string) {
    return computed(() => this.hasRole(role));
  }

  // Xử lý lỗi HTTP chung
  private handleError(error: HttpErrorResponse): Observable<never> {
    let apiError: ApiResponse<any>;
    let displayMessage = 'An unexpected error occurred. Please try again later.'; // Default error message

    if (error.error instanceof ErrorEvent) {
      // Lỗi client-side hoặc network.
      displayMessage = `Client or network error: ${error.error.message}`;
      console.error('An error occurred:', error.error.message);
      apiError = { success: false, message: displayMessage, status: 0, timestamp: new Date().toISOString() }; // Status 0 cho lỗi mạng/client
    } else {
      // Backend trả về mã lỗi.
      console.error(
        `Backend returned code ${error.status}, ` +
        `body was: ${JSON.stringify(error.error)}`);

      // Ưu tiên lấy message từ body lỗi của backend (nếu có dạng ApiResponse)
      if (error.error && typeof error.error === 'object' && 'message' in error.error) {
        displayMessage = error.error.message || 'Unknown server error';
        apiError = { ...error.error, success: false, status: error.status }; // Giữ nguyên cấu trúc lỗi từ backend
      } else {
        // Nếu không có body lỗi chuẩn, dùng statusText
        displayMessage = error.statusText || 'Unknown server error';
        apiError = { success: false, message: displayMessage, status: error.status, timestamp: new Date().toISOString() };
      }

      // Tự động logout nếu lỗi 401/403 (trừ khi đang ở trang login hoặc đang trong quá trình logout)
      if ((error.status === HttpStatus.UNAUTHORIZED || error.status === HttpStatus.FORBIDDEN) &&
        !this.router.url.includes('/auth/login') &&
        !this.isLoggingOut() && // << KHÔNG LOGOUT NẾU ĐANG TRONG QUÁ TRÌNH LOGOUT
        !error.url?.includes('/api/auth/refresh-token') && // Không logout nếu lỗi từ chính API refresh
        !error.url?.includes('/api/auth/logout') // << THÊM: Không logout nếu lỗi từ chính API logout
      ) {
        console.log(`AuthService.handleError: ${error.status} error on ${this.router.url}. Triggering logout.`);
        this.logout(); // Gọi logout
        // Ném lại lỗi để observable dừng lại, nhưng logout đã được trigger
        return throwError(() => apiError);
      }
    }
    // Ném lại lỗi dưới dạng ApiResponse để component có thể bắt và hiển thị message
    return throwError(() => apiError);
  }
  // Trong AuthService
  updateCurrentUser(user: UserResponse | null): void {
    this.currentUserSignal.set(user);
    // Effect sẽ tự lưu vào localStorage
  }
}
