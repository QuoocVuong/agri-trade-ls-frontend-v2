import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router'; // Import ActivatedRoute
import { AuthService } from '../../../../core/services/auth.service';
import { UserLoginRequest } from '../../../user-profile/dto/request/UserLoginRequest'; // Đổi đường dẫn nếu cần
import { ApiResponse } from '../../../../core/models/api-response.model';
import { LoginResponse } from '../../../user-profile/dto/response/LoginResponse'; // Đổi đường dẫn nếu cần

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute); // Inject ActivatedRoute

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
}
