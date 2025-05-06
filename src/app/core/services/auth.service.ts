import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError, BehaviorSubject, of } from 'rxjs';
import { catchError, tap, map, switchMap, finalize } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
// Import DTOs (đảm bảo đường dẫn đúng)
import { UserRegistrationRequest } from '../../features/user-profile/dto/request/UserRegistrationRequest';
import { UserLoginRequest } from '../../features/user-profile/dto/request/UserLoginRequest';
import { UserResponse } from '../../features/user-profile/dto/response/UserResponse';
import { LoginResponse } from '../../features/user-profile/dto/response/LoginResponse';
import { ForgotPasswordRequest } from '../../features/user-profile/dto/request/ForgotPasswordRequest';
import { ResetPasswordRequest } from '../../features/user-profile/dto/request/ResetPasswordRequest';
import {UserProfileResponse} from '../../features/user-profile/dto/response/UserProfileResponse';
import {AuthResponse} from '../models/auth-response.model';
import {SocialAuthService} from '@abacritt/angularx-social-login';

const AUTH_TOKEN_KEY = 'authToken';
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

  private apiUrl = `${environment.apiUrl}/auth`;
  private userApiUrl = `${environment.apiUrl}/users`;

  // --- State Management với Signals ---
  private authTokenSignal = signal<string | null>(this.getTokenFromStorage());
  private currentUserSignal = signal<UserResponse | null>(this.getUserFromStorage());
  private loadingSignal = signal<boolean>(false); // Signal cho trạng thái loading

  // Public signals
  public readonly currentToken = this.authTokenSignal.asReadonly();
  public readonly currentUser = this.currentUserSignal.asReadonly();
  public readonly isAuthenticated = computed(() => !!this.authTokenSignal());
  public readonly isLoading = this.loadingSignal.asReadonly(); // Signal loading public

  constructor() {
    // Effect để lưu vào localStorage
    effect(() => {
      const token = this.authTokenSignal();
      const user = this.currentUserSignal();
      if (typeof localStorage !== 'undefined') {
        if (token) {
          localStorage.setItem(AUTH_TOKEN_KEY, token);
        } else {
          localStorage.removeItem(AUTH_TOKEN_KEY);
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
  private getTokenFromStorage(): string | null {
    // Kiểm tra window tồn tại cho universal/SSR
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(AUTH_TOKEN_KEY);
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
          if (response.success && response.data?.accessToken) {
            // ****** GỌI setSession THAY VÌ SET TRỰC TIẾP ******
            this.setSession(response.data.accessToken);
            // Không cần set currentUserSignal ở đây nữa, refreshUserProfile sẽ làm
            // this.currentUserSignal.set(response.data.user);
            // *************************************************
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
    // Tùy chọn: Gọi API logout của backend nếu có (để blacklist token chẳng hạn)
    // const logoutUrl = `${environment.apiUrl}/auth/logout`;
    // this.http.post(logoutUrl, {}).pipe(
    //   finalize(() => { // Luôn clear data dù API logout thành công hay không
    //     this.clearAuthData();
    //     this.router.navigate(['/auth/login']);
    //   })
    // ).subscribe();

    // Nếu không có API logout backend:
// Nếu không có API logout backend, thực hiện logout frontend ngay
    this.performFrontendLogout();
  }

  // Tách logic logout frontend ra hàm riêng
  private performFrontendLogout(): void {
    // 1. Đăng xuất khỏi SocialAuthService trước
    this.socialAuthService.signOut()
      .then(() => {
        console.log('User signed out from social provider');
      })
      .catch(err => {
        console.error('Error signing out from social provider:', err);
      })
      .finally(() => {
        // 2. Luôn xóa dữ liệu ứng dụng và điều hướng sau khi thử signOut
        this.clearAuthData();
        this.router.navigate(['/auth/login']);
        console.log('Local auth data cleared and navigated to login');
      });
  }
  // ****************************

  // --- Phương thức mới để làm mới thông tin user profile ---
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
            // Hoặc bạn có thể lưu cả UserProfileResponse nếu muốn
            const basicUserInfo: UserResponse = {
              id: response.data.id,
              email: response.data.email,
              fullName: response.data.fullName,
              phoneNumber: response.data.phoneNumber,
              avatarUrl: response.data.avatarUrl,
              roles: response.data.roles,
              isActive: response.data.isActive,
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

  // ****** THÊM HÀM LOGIN GOOGLE ******
  loginWithGoogle(idToken: string): Observable<ApiResponse<AuthResponse>> {
    const requestBody = { idToken };
    // Gọi API backend mới tạo
    return this.http.post<ApiResponse<AuthResponse>>(`${this.apiUrl}/oauth2/google/verify`, requestBody)
      .pipe(
        tap(response => {
          if (response.success && response.data?.accessToken) {
            this.setSession(response.data.accessToken); // Lưu token JWT trả về
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
  // **********************************

  // ****** THÊM PHƯƠNG THỨC NÀY ******
  private setSession(token: string | null): void {
    if (token) {
      this.authTokenSignal.set(token);
      // Tự động tải/làm mới thông tin người dùng sau khi có token
      this.refreshUserProfile().subscribe({
        error: (err) => {
          // Xử lý lỗi nếu không thể tải profile sau khi đăng nhập
          console.error("Failed to load user profile after setting session:", err);
          // Có thể cân nhắc logout nếu không lấy được profile
          // this.logout();
        }
      });
    } else {
      // Nếu token là null (ví dụ: logout), xóa dữ liệu
      this.clearAuthData();
    }
    // Effect trong constructor sẽ tự động xử lý việc lưu/xóa localStorage
  }
  // **********************************

  // --- Helper Methods ---

  private clearAuthData(): void {
    this.authTokenSignal.set(null);
    this.currentUserSignal.set(null);
    // Xóa khỏi localStorage sẽ được thực hiện bởi effect
  }

  getToken(): string | null {
    return this.authTokenSignal();
  }

  getCurrentUser(): UserResponse | null {
    return this.currentUserSignal();
  }

  // Kiểm tra role (dùng cho guard và component logic)
  hasRole(role: string): boolean {
    const user = this.currentUserSignal();
    // Thêm kiểm tra null an toàn
    return !!user && Array.isArray(user.roles) && user.roles.includes(role);
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

      // Tự động logout nếu lỗi 401/403 (trừ khi đang ở trang login?)
      if ((error.status === 401 || error.status === 403) && !this.router.url.includes('/auth/login')) {
        console.log(`Unauthorized (401) or Forbidden (403) error detected on ${this.router.url}. Logging out.`);
        this.logout(); // Gọi logout để xóa token và điều hướng
        // Trả về lỗi để observable dừng lại
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
