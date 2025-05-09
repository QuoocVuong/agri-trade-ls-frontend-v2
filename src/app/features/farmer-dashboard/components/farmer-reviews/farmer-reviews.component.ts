// src/app/features/farmer-dashboard/components/farmer-reviews/farmer-reviews.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReviewListComponent } from '../../../interaction/components/review-list/review-list.component'; // Import ReviewListComponent
import { ReviewStatus } from '../../../../common/model/review-status.enum'; // Import nếu dùng filter

@Component({
  selector: 'app-farmer-reviews',
  standalone: true,
  imports: [CommonModule, ReviewListComponent], // Import ReviewListComponent
  template: `
    <div class="container mx-auto px-4 py-6">
      <h1 class="text-2xl font-bold mb-6">Đánh giá Sản phẩm của bạn</h1>

      <!-- (Tùy chọn) Thêm bộ lọc theo trạng thái nếu cần -->
      <!--
      <div class="mb-4">
        <label class="mr-2">Lọc theo trạng thái:</label>
        <select (change)="onStatusFilterChange($event)" class="select select-sm select-bordered">
          <option [value]="null">Tất cả</option>
          <option [value]="ReviewStatusEnum.APPROVED">Đã duyệt</option>
          <option [value]="ReviewStatusEnum.PENDING">Chờ duyệt</option>
          <option [value]="ReviewStatusEnum.REJECTED">Bị từ chối</option>
        </select>
      </div>
      -->

      <app-review-list
        [mode]="'farmer_product_reviews'"
        [showAdminActions]="false"> <!-- Farmer không có quyền duyệt/xóa -->
        <!-- (Tùy chọn) Truyền statusFilter nếu có bộ lọc -->
        <!-- [statusFilter]="selectedStatus()" -->
      </app-review-list>
    </div>
  `,
})
export class FarmerReviewsComponent {
  // (Tùy chọn) Logic cho bộ lọc trạng thái
  // ReviewStatusEnum = ReviewStatus;
  // selectedStatus = signal<ReviewStatus | null>(null);
  // onStatusFilterChange(event: Event) {
  //   const selectElement = event.target as HTMLSelectElement;
  //   this.selectedStatus.set(selectElement.value as ReviewStatus | null);
  // }
}
