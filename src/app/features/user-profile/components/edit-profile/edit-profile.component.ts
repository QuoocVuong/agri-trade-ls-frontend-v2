import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { UserProfileService } from '../../services/user-profile.service';
import { AuthService } from '../../../../core/services/auth.service';
import { UserResponse } from '../../dto/response/UserResponse';
import { UserUpdateRequest } from '../../dto/request/UserUpdateRequest';
import { ApiResponse } from '../../../../core/models/api-response.model';
import {AlertComponent} from '../../../../shared/components/alert/alert.component';


@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AlertComponent, ],
  templateUrl: './edit-profile.component.html',
})
export class EditProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userProfileService = inject(UserProfileService);
  private authService = inject(AuthService);
  private router = inject(Router);

  public profileForm!: FormGroup; // Dùng ! để báo TypeScript sẽ khởi tạo trong ngOnInit
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  currentUser = this.authService.currentUser; // Lấy user hiện tại từ AuthService

  ngOnInit(): void {
    this.profileForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.maxLength(100)]],
      phoneNumber: ['', [Validators.maxLength(20)]], // Thêm pattern nếu cần
      avatarUrl: ['', [Validators.maxLength(512)]] // Thêm Validators.pattern nếu cần check URL
    });

    // Điền dữ liệu hiện tại vào form
    const user = this.currentUser();
    if (user) {
      this.profileForm.patchValue({
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        avatarUrl: user.avatarUrl
      });
    } else {
      // Lỗi: không lấy được thông tin user -> quay về đâu đó hoặc báo lỗi
      this.errorMessage.set('Không thể tải thông tin người dùng.');
      // this.router.navigate(['/']);
    }
  }

  onSubmit(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched(); // Hiển thị lỗi validation nếu có
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const updateData: UserUpdateRequest = this.profileForm.value;

    this.userProfileService.updateMyProfile(updateData).subscribe({
      next: (response: ApiResponse<UserResponse>) => {
        if (response.success && response.data) {
          this.successMessage.set(response.message || 'Cập nhật hồ sơ thành công!');
          // Cập nhật lại thông tin user trong AuthService
          this.authService.updateCurrentUser(response.data); // Cần tạo hàm này trong AuthService
          // Có thể redirect sau vài giây hoặc để user tự điều hướng
          // setTimeout(() => this.router.navigate(['/user/profile']), 1500);
        } else {
          this.errorMessage.set(response.message || 'Cập nhật hồ sơ thất bại.');
        }
        this.isLoading.set(false);
      },
      error: (err: ApiResponse<null>) => {
        this.errorMessage.set(err.message || 'Đã xảy ra lỗi khi cập nhật.');
        this.isLoading.set(false);
        console.error(err);
      }
    });
  }
}
