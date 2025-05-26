import {
  Component,
  OnInit,
  inject,
  signal,
  Input,
  OnChanges,
  SimpleChanges,
  computed,
  EventEmitter,
  Output
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReviewService } from '../../service/ReviewService';
import { ReviewResponse } from '../../dto/response/ReviewResponse';
import { Page } from '../../../../core/models/page.model';
import { PagedApiResponse } from '../../../../core/models/api-response.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component'; // Import Paginator
import { AuthService } from '../../../../core/services/auth.service'; // Import AuthService
import { getReviewStatusText, getReviewStatusCssClass } from '../../../../common/model/review-status.enum'; // Import thêm hàm text/css

type ReviewListMode = 'product' | 'my' | 'admin_manage'| 'farmer_product_reviews'; // Bỏ 'admin_pending', thay bằng 'admin_manage'

@Component({
  selector: 'app-review-list',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent, AlertComponent, PaginatorComponent, DatePipe, RouterLink, TimeAgoPipe],
  templateUrl: './review-list.component.html',
})
export class ReviewListComponent implements OnInit, OnChanges {


  @Input() productId?: number | null; // ID sản phẩm nếu mode='product'
  @Input() mode: ReviewListMode = 'product'; // Chế độ hiển thị
  @Input() statusFilter?: ReviewStatus | null = null; // <<< Input mới để lọc theo status (cho admin)
  @Input() showAdminActions: boolean = false; // <<< Input để quyết định có hiện nút admin không

  // Output events để component cha xử lý (nếu cần)
  @Output() reviewApproved = new EventEmitter<number>();
  @Output() reviewRejected = new EventEmitter<number>();
  @Output() reviewDeleted = new EventEmitter<number>();

  private reviewService = inject(ReviewService);
  private adminInteractionService = inject(AdminInteractionService); // Inject Admin Service
  private authService = inject(AuthService); // Inject để lấy user nếu mode='my'

  reviewsPage = signal<Page<ReviewResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  // Phân trang
  currentPage = signal(0);
  pageSize = signal(10); // Số review mỗi trang
  sort = signal('createdAt,desc'); // Sắp xếp mặc định

  // Computed signal để lấy tổng số trang
  totalPages = computed(() => this.reviewsPage()?.totalPages ?? 0);


  // Helpers để dùng trong template
  getReviewStatusText = getReviewStatusText;
  getReviewStatusCssClass = getReviewStatusCssClass;
  ReviewStatusEnum = ReviewStatus; // Để so sánh trong template

  ngOnInit(): void {
    // Load lần đầu dựa trên mode và input ban đầu
    this.loadReviews();
  }

  ngOnChanges(changes: SimpleChanges): void {
    let shouldReload = false;
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

    // Load lại nếu statusFilter thay đổi (và mode là admin)
    if (changes['statusFilter'] && !changes['statusFilter'].firstChange && this.mode === 'admin_manage') {
      shouldReload = true;
    }
    if (changes['showAdminActions'] && !changes['showAdminActions'].firstChange) {
      // Không cần load lại, chỉ là thay đổi hiển thị nút
    }

    if (shouldReload) {
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
      case 'admin_manage': // Chế độ quản lý của Admin
        if (this.statusFilter === null || this.statusFilter === undefined) {
          this.errorMessage.set('Vui lòng chọn trạng thái đánh giá để lọc.');
          this.isLoading.set(false);
          this.reviewsPage.set(null); // Xóa dữ liệu cũ
          return;
        }
        // Gọi service của Admin để lấy theo statusFilter
        apiCall = this.adminInteractionService.getReviewsByStatus(this.statusFilter, page, size, sort);
        break;
      case 'farmer_product_reviews':
        // Gọi service của Farmer để lấy review sản phẩm của họ
        // (Tùy chọn) Truyền statusFilter nếu có
        apiCall = this.reviewService.getReviewsForMyProducts(page, size, sort /*, this.statusFilter() */);
        break;
      default:
        this.errorMessage.set('Chế độ xem danh sách đánh giá không hợp lệ.');
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


  // --- Admin Actions ---
  // Các hàm này giờ chỉ gọi service, không cần check mode nữa vì component cha sẽ quyết định có gọi hay không
  approveReview(reviewId: number): void {
    console.log("Approving review:", reviewId);
    // Gọi service admin
    this.adminInteractionService.approveReview(reviewId).subscribe({
      next: () => {
        this.reviewApproved.emit(reviewId); // Thông báo cho cha
        this.loadReviews(); // Load lại list
      },
      error: (err) => this.errorMessage.set(err.message || 'Lỗi duyệt đánh giá')
    });
  }

  rejectReview(reviewId: number): void {
    console.log("Rejecting review:", reviewId);
    this.adminInteractionService.rejectReview(reviewId).subscribe({
      next: () => {
        this.reviewRejected.emit(reviewId); // Thông báo cho cha
        this.loadReviews();
      },
      error: (err) => this.errorMessage.set(err.message || 'Lỗi từ chối đánh giá')
    });
  }

  deleteReview(reviewId: number): void {
    if(confirm('Bạn có chắc muốn xóa vĩnh viễn đánh giá này? Hành động này không thể hoàn tác.')) {
      console.log("Deleting review:", reviewId);
      this.adminInteractionService.deleteReview(reviewId).subscribe({
        next: () => {
          this.reviewDeleted.emit(reviewId); // Thông báo cho cha
          this.loadReviews();
        },
        error: (err) => this.errorMessage.set(err.message || 'Lỗi xóa đánh giá')
      });
    }
  }
}

// Cần import ReviewStatus vào đây nếu dùng mode admin_pending
import { ReviewStatus } from '../../../../common/model/review-status.enum';
import { Observable } from 'rxjs';
import {AdminInteractionService} from '../../../admin-dashboard/services/admin-interaction.service';
import {Router, RouterLink} from '@angular/router';
import {TimeAgoPipe} from '../../../../shared/pipes/time-ago.pipe';
//import { PagedApiResponse } from '../../../../core/models/api-response.model';
