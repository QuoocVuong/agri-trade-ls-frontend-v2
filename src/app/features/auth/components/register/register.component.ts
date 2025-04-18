import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, ValidationErrors, AbstractControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { UserRegistrationRequest } from '../../../user-profile/dto/request/UserRegistrationRequest';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { UserResponse } from '../../../user-profile/dto/response/UserResponse';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  registerForm!: FormGroup;
  isLoading = this.authService.isLoading;
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      phoneNumber: ['', [Validators.maxLength(20), Validators.pattern(/^(84|0)(3|5|7|8|9)[0-9]{8}$/)
      ]], // Optional, VN pattern
      password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(100)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    if (password?.value !== confirmPassword?.value) {
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
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);

    const registerData: UserRegistrationRequest = {
      fullName: this.registerForm.value.fullName,
      email: this.registerForm.value.email,
      phoneNumber: this.registerForm.value.phoneNumber || null, // Gửi null nếu rỗng
      password: this.registerForm.value.password
    };

    this.authService.register(registerData).subscribe({
      next: (response: ApiResponse<UserResponse>) => {
        if (response.success) {
          this.successMessage.set(response.message || 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.');
          this.registerForm.reset();
          // Không chuyển hướng ngay, để user đọc thông báo
           setTimeout(() => this.router.navigate(['/auth/login']), 3000);
        } else {
          this.errorMessage.set(response.message || 'Đăng ký thất bại.');
        }
      },
      error: (err: ApiResponse<any>) => { // Nhận cả lỗi validation từ GlobalExceptionHandler
        if (err.data && typeof err.data === 'object') {
          // Hiển thị lỗi validation cụ thể nếu có
          const validationErrors = Object.entries(err.data)
            .map(([field, message]) => `${field}: ${message}`)
            .join('\n');
          this.errorMessage.set(`Lỗi dữ liệu:\n${validationErrors}`);
        } else {
          this.errorMessage.set(err.message || 'Đã xảy ra lỗi khi đăng ký.');
        }
        console.error('Register error', err);
      }
    });
  }
}
