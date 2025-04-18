import { Component, OnInit, inject, signal, Input, OnChanges, SimpleChanges, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReviewService } from '../../service/ReviewService';
import { ReviewResponse } from '../../dto/response/ReviewResponse';
import { Page } from '../../../../core/models/page.model';
import { PagedApiResponse } from '../../../../core/models/api-response.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component'; // Import Paginator
import { AuthService } from '../../../../core/services/auth.service'; // Import AuthService

type ReviewListMode = 'product' | 'my' | 'admin_pending'; // Các chế độ hiển thị

@Component({
  selector: 'app-review-list',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent, AlertComponent, PaginatorComponent, DatePipe],
  templateUrl: './review-list.component.html',
})
export class ReviewListComponent implements OnInit, OnChanges {
  @Input() productId?: number | null; // ID sản phẩm nếu mode='product'
  @Input() mode: ReviewListMode = 'product'; // Chế độ hiển thị

  private reviewService = inject(ReviewService);
  private authService = inject(AuthService); // Inject để lấy user nếu mode='my'

  reviewsPage = signal<Page<ReviewResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  // Phân trang
  currentPage = signal(0);
  pageSize = signal(5); // Số review mỗi trang
  sort = signal('createdAt,desc'); // Sắp xếp mặc định

  // Computed signal để lấy tổng số trang
  totalPages = computed(() => this.reviewsPage()?.totalPages ?? 0);

  ngOnInit(): void {
    // Load lần đầu dựa trên mode và input ban đầu
    this.loadReviews();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Load lại nếu productId thay đổi (và mode là 'product')
    if (changes['productId'] && !changes['productId'].firstChange && this.mode === 'product') {
      this.currentPage.set(0); // Reset về trang đầu
      this.loadReviews();
    }
    // Load lại nếu mode thay đổi
    if (changes['mode'] && !changes['mode'].firstChange) {
      this.currentPage.set(0);
      this.loadReviews();
    }
  }

  loadReviews(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const page = this.currentPage();
    const size = this.pageSize();
    const sort = this.sort();

    let apiCall: Observable<PagedApiResponse<ReviewResponse>>;

    switch (this.mode) {
      case 'product':
        if (!this.productId) {
          this.errorMessage.set('Product ID is required for product reviews.');
          this.isLoading.set(false);
          return;
        }
        apiCall = this.reviewService.getApprovedReviewsByProduct(this.productId, page, size, sort);
        break;
      case 'my':
        // Cần đảm bảo user đã đăng nhập (có thể thêm guard ở route)
        apiCall = this.reviewService.getMyReviews(page, size, sort);
        break;
      case 'admin_pending':
        // Cần role Admin (thêm guard ở route)
        apiCall = this.reviewService.getReviewsByStatus(ReviewStatus.PENDING, page, size, sort);
        break;
      default:
        this.errorMessage.set('Invalid review list mode.');
        this.isLoading.set(false);
        return;
    }

    apiCall.subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.reviewsPage.set(response.data);
        } else {
          this.reviewsPage.set(null);
          // Không hiện lỗi nếu chỉ là không có review
          if(response.status !== 404) this.errorMessage.set(response.message || 'Không tải được đánh giá.');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.reviewsPage.set(null);
        this.errorMessage.set(err.message || 'Đã xảy ra lỗi.');
        this.isLoading.set(false);
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadReviews(); // Load lại trang mới
  }

  trackReviewById(index: number, review: ReviewResponse): number {
    return review.id;
  }

  // TODO: Thêm các hàm xử lý cho Admin (approve, reject, delete) nếu mode là admin_pending
  approveReview(reviewId: number): void {
    if (this.mode !== 'admin_pending') return;
    console.log("Approving review:", reviewId);
    this.reviewService.approveReview(reviewId).subscribe({
      next: () => this.loadReviews(), // Load lại list sau khi duyệt
      error: (err) => this.errorMessage.set(err.message || 'Lỗi duyệt đánh giá')
    });
  }
  rejectReview(reviewId: number): void {
    if (this.mode !== 'admin_pending') return;
    console.log("Rejecting review:", reviewId);
    this.reviewService.rejectReview(reviewId).subscribe({
      next: () => this.loadReviews(),
      error: (err) => this.errorMessage.set(err.message || 'Lỗi từ chối đánh giá')
    });
  }
  deleteReview(reviewId: number): void {
    if (this.mode !== 'admin_pending') return; // Hoặc cho phép user xóa review của mình
    if(confirm('Bạn có chắc muốn xóa đánh giá này?')) {
      console.log("Deleting review:", reviewId);
      this.reviewService.deleteReview(reviewId).subscribe({
        next: () => this.loadReviews(),
        error: (err) => this.errorMessage.set(err.message || 'Lỗi xóa đánh giá')
      });
    }
  }
}

// Cần import ReviewStatus vào đây nếu dùng mode admin_pending
import { ReviewStatus } from '../../../../common/model/review-status.enum';
import { Observable } from 'rxjs';
//import { PagedApiResponse } from '../../../../core/models/api-response.model';
