import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ApiResponse } from '../../../../core/models/api-response.model';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './verify-email.component.html',
})
export class VerifyEmailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private router = inject(Router); // Inject Router

  isLoading = signal(true); // Bắt đầu là loading
  verificationStatus = signal<'verifying' | 'success' | 'error'>('verifying');
  message = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token'); // Lấy token từ query params

    if (!token) {
      this.message.set('Token xác thực không hợp lệ hoặc bị thiếu.');
      this.verificationStatus.set('error');
      this.isLoading.set(false);
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: (response: ApiResponse<void>) => {
        if (response.success) {
          this.message.set(response.message || 'Xác thực email thành công! Bạn có thể đăng nhập ngay bây giờ.');
          this.verificationStatus.set('success');
        } else {
          this.message.set(response.message || 'Xác thực email thất bại.');
          this.verificationStatus.set('error');
        }
        this.isLoading.set(false);
      },
      error: (err: ApiResponse<null>) => {
        this.message.set(err.message || 'Đã xảy ra lỗi trong quá trình xác thực.');
        this.verificationStatus.set('error');
        this.isLoading.set(false);
        console.error('Verify email error', err);
      }
    });
  }

  navigateToLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}
