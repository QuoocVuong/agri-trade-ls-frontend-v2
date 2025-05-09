import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReviewService } from '../../service/ReviewService';
import { ReviewRequest } from '../../dto/request/ReviewRequest';
import { ReviewResponse } from '../../dto/response/ReviewResponse';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service'; // Import AuthService
import { ToastrService } from 'ngx-toastr';
import {RouterLink} from '@angular/router';

@Component({
  selector: 'app-review-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink ],
  templateUrl: './review-form.component.html',
})
export class ReviewFormComponent {
  @Input({ required: true }) productId!: number;
  @Input() orderId?: number | null; // Optional order ID
  @Output() reviewSubmitted = new EventEmitter<ReviewResponse>();

  private fb = inject(FormBuilder);
  private reviewService = inject(ReviewService);
  private authService = inject(AuthService); // Inject AuthService
  private toastr = inject(ToastrService);

  reviewForm: FormGroup;
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  hoverRating = signal(0); // Rating khi hover
  selectedRating = signal(0); // Rating đã chọn

  // Kiểm tra xem user đã đăng nhập chưa
  isAuthenticated = this.authService.isAuthenticated;

  constructor() {
    this.reviewForm = this.fb.group({
      rating: [null, [Validators.required, Validators.min(1), Validators.max(5)]],
      comment: ['', [Validators.maxLength(1000)]]
    });
  }

  setRating(rating: number): void {
    this.selectedRating.set(rating);
    this.reviewForm.controls['rating'].setValue(rating);
    this.reviewForm.controls['rating'].markAsTouched(); // Đánh dấu đã chạm để validation
  }

  setHoverRating(rating: number): void {
    this.hoverRating.set(rating);
  }

  resetHoverRating(): void {
    this.hoverRating.set(0);
  }

  onSubmit(): void {
    if (this.reviewForm.invalid) {
      this.reviewForm.markAllAsTouched();
      return;
    }
    if (!this.isAuthenticated()) {
      this.toastr.warning("Vui lòng đăng nhập để gửi đánh giá.");
      // Có thể điều hướng đến login
      return;
    }


    this.isLoading.set(true);
    this.errorMessage.set(null);

    const requestData: ReviewRequest = {
      productId: this.productId,
      orderId: this.orderId, // Truyền orderId nếu có
      rating: this.reviewForm.value.rating,
      comment: this.reviewForm.value.comment || null
    };

    this.reviewService.createReview(requestData).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.reviewSubmitted.emit(response.data); // Gửi sự kiện thành công
          this.reviewForm.reset(); // Xóa form
          this.selectedRating.set(0); // Reset sao đã chọn
          this.toastr.success("Gửi đánh giá thành công.");
        } else {
          this.errorMessage.set(response.message || 'Gửi đánh giá thất bại.');
        }
        this.isLoading.set(false);
      },
      error: (err: ApiResponse<null>) => {
        this.errorMessage.set(err.message || 'Đã xảy ra lỗi khi gửi đánh giá.');
        this.isLoading.set(false);
      }
    });
  }
}
