import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, ValidationErrors, AbstractControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {  RouterLink } from '@angular/router';
import { UserProfileService } from '../../services/user-profile.service';
import { PasswordChangeRequest } from '../../dto/request/PasswordChangeRequest';
import { ApiResponse } from '../../../../core/models/api-response.model';


@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink ],
  templateUrl: './change-password.component.html',
})
export class ChangePasswordComponent {
  private fb = inject(FormBuilder);
  private userProfileService = inject(UserProfileService);


  passwordForm: FormGroup;
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  constructor() {
    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(100)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator }); // Thêm validator kiểm tra khớp mật khẩu
  }

  // Custom validator để kiểm tra newPassword và confirmPassword có khớp không
  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('newPassword');
    const confirmPassword = control.get('confirmPassword');

    if (newPassword?.value !== confirmPassword?.value) {
      confirmPassword?.setErrors({ passwordMismatch: true }); // Set lỗi cho trường confirmPassword
      return { passwordMismatch: true };
    } else {
      // Nếu trước đó có lỗi mismatch, cần xóa nó đi khi mật khẩu khớp
      if (confirmPassword?.hasError('passwordMismatch')) {
        confirmPassword.setErrors(null);
      }
      return null;
    }
  }


  onSubmit(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const requestData: PasswordChangeRequest = {
      currentPassword: this.passwordForm.value.currentPassword,
      newPassword: this.passwordForm.value.newPassword
    };

    this.userProfileService.changePassword(requestData).subscribe({
      next: (response: ApiResponse<void>) => {
        this.successMessage.set(response.message || 'Đổi mật khẩu thành công!');
        this.passwordForm.reset(); // Xóa form sau khi thành công
        // Có thể redirect sau vài giây
        // setTimeout(() => this.router.navigate(['/user/profile']), 2000);
        this.isLoading.set(false);
      },
      error: (err: ApiResponse<null>) => {
        this.errorMessage.set(err.message || 'Đã xảy ra lỗi khi đổi mật khẩu.');
        this.isLoading.set(false);
        console.error(err);
      }
    });
  }
}
