import {Component, OnInit, inject, signal, OnDestroy} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { UserLoginRequest } from '../../../user-profile/dto/request/UserLoginRequest';
import { ApiResponse } from '../../../../core/models/api-response.model';

import {Subject, Subscription} from 'rxjs';
import {
  GoogleLoginProvider,
  GoogleSigninButtonModule,
  SocialAuthService,
  SocialUser
} from '@abacritt/angularx-social-login';
import {filter, takeUntil} from 'rxjs/operators';
import {ToastrService} from 'ngx-toastr';
import {AlertComponent} from '../../../../shared/components/alert/alert.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, GoogleSigninButtonModule, AlertComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit, OnDestroy  {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private socialAuthService = inject(SocialAuthService);

  private toastr = inject(ToastrService);

  private authSubscription: Subscription | null = null; // Để hủy subscribe

  loginForm!: FormGroup;
  isLoading = this.authService.isLoading; // Lấy signal loading từ service
  errorMessage = signal<string | null>(null);
  private returnUrl: string = '/'; // URL mặc định sau khi login

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });

    // Lấy returnUrl từ query params (nếu có, do guard điều hướng tới)
    this.route.queryParams.subscribe(params => {
      this.returnUrl = params['returnUrl'] || '/'; // Lấy returnUrl hoặc về trang chủ
    });

    // Nếu đã đăng nhập rồi thì redirect về trang chủ (hoặc returnUrl)
    if (this.authService.isAuthenticated()) {
      this.router.navigateByUrl(this.returnUrl);
    }

    this.authSubscription = this.socialAuthService.authState
      .pipe(
        takeUntil(this.destroy$),
        filter(() => !this.authService.isLoggingOut())
      )
      .subscribe((user: SocialUser) => {
        console.log("Social User State Changed (not during logout):", user);
        if (user && user.provider === GoogleLoginProvider.PROVIDER_ID && user.idToken) {
          this.handleGoogleSignIn(user.idToken);

        }
      });

  }


  private destroy$ = new Subject<void>();
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

  }


  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null); // Reset lỗi cũ
    const loginData: UserLoginRequest = this.loginForm.value;

    this.authService.login(loginData).subscribe({
      next: (response) => {
        // AuthService đã xử lý lưu token và user
        console.log('Login successful', response);
        // Điều hướng đến returnUrl hoặc trang chủ
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (err: ApiResponse<null>) => {
        this.errorMessage.set(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại email hoặc mật khẩu.');
        console.error('Login error', err);
      }
      // finalize đã được xử lý trong service để tắt loading
    });
  }


  handleGoogleSignIn(idToken: string): void {
    // Không set isLoading ở đây vì AuthService sẽ làm
    this.errorMessage.set(null);
    console.log("Sending Google ID Token to backend...");

    this.authService.loginWithGoogle(idToken)
      // Không cần finalize ở đây vì isLoading lấy từ service
      .subscribe({
        next: (response) => {
          console.log("Backend Google Sign-In successful");
          this.toastr.success('Đăng nhập bằng Google thành công!');
          this.router.navigateByUrl(this.returnUrl);
        },
        error: (err: ApiResponse<null>) => { // Nhận kiểu lỗi ApiResponse
          console.error("Backend Google Sign-In failed:", err);
          this.errorMessage.set(err.message || 'Đăng nhập bằng Google thất bại.');
        }
      });
  }

}
