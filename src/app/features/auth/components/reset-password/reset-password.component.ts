import { Component, OnInit, inject, signal, WritableSignal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, ValidationErrors, AbstractControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router'; // Import ActivatedRoute
import { AuthService } from '../../../../core/services/auth.service';
import { ResetPasswordRequest } from '../../../user-profile/dto/request/ResetPasswordRequest';
import { ApiResponse } from '../../../../core/models/api-response.model';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute); // Inject ActivatedRoute

  resetPasswordForm!: FormGroup;
  isLoading: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal(null);
  successMessage: WritableSignal<string | null> = signal(null);
  token: string | null = null; // Lưu token từ URL


  ngOnInit(): void {
    // Lấy token từ query params
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      if (!this.token) {
        this.errorMessage.set('Token đặt lại mật khẩu không hợp lệ hoặc bị thiếu.');
        // Có thể điều hướng về trang khác
        // this.router.navigate(['/auth/forgot-password']);
      }
    });

    this.resetPasswordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(100)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    // ... (validator giống như RegisterComponent)
    const newPassword = control.get('newPassword');
    const confirmPassword = control.get('confirmPassword');
    if (newPassword?.value !== confirmPassword?.value) {
      confirmPassword?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    } else {
      if (confirmPassword?.hasError('passwordMismatch')) {
        confirmPassword.setErrors(null);
      }
      return null;
    }
  }

  onSubmit(): void {
    if (this.resetPasswordForm.invalid || !this.token) {
      this.resetPasswordForm.markAllAsTouched();
      if (!this.token) {
        this.errorMessage.set('Không tìm thấy token đặt lại mật khẩu.');
      }
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const requestData: ResetPasswordRequest = {
      token: this.token,
      newPassword: this.resetPasswordForm.value.newPassword
    };

    this.authService.resetPassword(requestData).subscribe({
      next: (response: ApiResponse<void>) => {
        this.successMessage.set(response.message || 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.');
        this.resetPasswordForm.reset();
        // Điều hướng về trang login sau vài giây
        setTimeout(() => this.router.navigate(['/auth/login']), 3000);
      },
      error: (err: ApiResponse<null>) => {
        this.errorMessage.set(err.message || 'Đặt lại mật khẩu thất bại. Token có thể đã hết hạn hoặc không hợp lệ.');
        console.error('Reset password error', err);
      },
      complete: () => this.isLoading.set(false) // Tắt loading khi hoàn thành
    });
  }
}
