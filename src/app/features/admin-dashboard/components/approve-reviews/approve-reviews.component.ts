// src/app/features/admin/components/approve-reviews/approve-reviews.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReviewListComponent } from '../../../interaction/components/review-list/review-list.component'; // Import ReviewListComponent
import { ReviewStatus, getReviewStatusText } from '../../../../common/model/review-status.enum'; // Import Enum và helper
import { ToastrService } from 'ngx-toastr'; // Import Toastr

@Component({
  selector: 'app-approve-reviews',
  standalone: true,
  imports: [CommonModule, ReviewListComponent], // Import ReviewListComponent
  templateUrl: './approve-reviews.component.html',
  styleUrl: './approve-reviews.component.css'
})
export class ApproveReviewsComponent {
  private toastr = inject(ToastrService);

  // Danh sách các trạng thái để tạo tab/button lọc
  statuses = [ReviewStatus.PENDING, ReviewStatus.APPROVED, ReviewStatus.REJECTED];
  // Signal để lưu trạng thái đang được chọn
  selectedStatus = signal<ReviewStatus>(ReviewStatus.PENDING); // Mặc định hiển thị PENDING

  // Helper để lấy text cho tab
  getStatusText = getReviewStatusText;

  // Hàm để thay đổi trạng thái lọc khi click tab/button
  selectStatus(status: ReviewStatus): void {
    this.selectedStatus.set(status);
    // ReviewListComponent sẽ tự động load lại nhờ ngOnChanges
  }

  // (Optional) Xử lý sự kiện từ ReviewListComponent
  onReviewApproved(reviewId: number): void {
    this.toastr.success(`Đánh giá #${reviewId} đã được duyệt.`);
    // Có thể cần load lại nếu đang ở tab REJECTED
    if (this.selectedStatus() === ReviewStatus.REJECTED) {
      // Nếu muốn tự chuyển tab hoặc làm gì đó
    }
  }

  onReviewRejected(reviewId: number): void {
    this.toastr.warning(`Đánh giá #${reviewId} đã bị từ chối.`);
  }

  onReviewDeleted(reviewId: number): void {
    this.toastr.info(`Đánh giá #${reviewId} đã được xóa.`);
  }

  protected readonly ReviewStatus = ReviewStatus;
}
