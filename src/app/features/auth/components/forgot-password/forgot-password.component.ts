import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ForgotPasswordRequest } from '../../../user-profile/dto/request//ForgotPasswordRequest';
import { ApiResponse } from '../../../../core/models/api-response.model';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
})
export class ForgotPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  forgotPasswordForm!: FormGroup;
  isLoading = this.authService.isLoading;
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit(): void {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    const requestData: ForgotPasswordRequest = this.forgotPasswordForm.value;

    this.authService.forgotPassword(requestData).subscribe({
      next: (response: ApiResponse<void>) => {
        // Luôn hiển thị thông báo thành công chung chung
        this.successMessage.set("Nếu email của bạn tồn tại trong hệ thống, một liên kết đặt lại mật khẩu đã được gửi.");
        this.forgotPasswordForm.reset(); // Reset form
      },
      error: (err: ApiResponse<null>) => {
        // Vẫn hiển thị thông báo thành công chung chung để tránh lộ thông tin
        this.successMessage.set("Nếu email của bạn tồn tại trong hệ thống, một liên kết đặt lại mật khẩu đã được gửi.");
        console.error('Forgot password error (but showing success message):', err);
      }
    });
  }
}
