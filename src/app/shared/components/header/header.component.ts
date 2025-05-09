import {
  AfterViewInit,
  Component,
  computed, effect,
  ElementRef,
  EventEmitter,
  inject,
  Output,
  signal,
  ViewChild
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service'; // Import AuthService
import {CommonModule, DatePipe} from '@angular/common';
import {NotificationService} from '../../../features/notification/service/notification.service';
import {CartService} from '../../../features/ordering/services/cart.service';
import {FormatBigDecimalPipe} from '../../pipes/format-big-decimal.pipe';
import {Subject} from 'rxjs';
import {NotificationResponse} from '../../../features/notification/dto/response/NotificationResponse';
import {finalize, takeUntil} from 'rxjs/operators'; // Import CommonModule for *ngIf etc.
//import { UserResponse } from '../../../usermanagement/dto/response/UserResponse'; // Import UserResponse if needed directly
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import {LoadingSpinnerComponent} from '../loading-spinner/loading-spinner.component';
import {AlertComponent} from '../alert/alert.component';
import {getNotificationTypeIcon} from '../../../common/model/notification-type.enum';
import {SafeHtmlPipe} from '../../pipes/safe-html.pipe';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, FormatBigDecimalPipe, DatePipe, TimeAgoPipe, LoadingSpinnerComponent, AlertComponent], // Import CommonModule
  templateUrl: './header.component.html',
})
export class HeaderComponent implements AfterViewInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private cartService = inject(CartService); // <-- Inject CartService
  private notificationService = inject(NotificationService); // <-- Inject NotificationService
  private destroy$ = new Subject<void>();



  // Sử dụng signal từ AuthService để biết trạng thái đăng nhập và thông tin user
  isLoggedIn = this.authService.isAuthenticated; // Giả sử AuthService có signal này
  user = this.authService.currentUser; // Giả sử AuthService có signal này
  // Lấy signal số lượng từ các service
  cartItemCount = this.cartService.totalItems; // <-- Lấy signal từ CartService
  unreadNotificationCount = this.notificationService.unreadCount; // <-- Lấy signal từ NotificationService

  cartSubTotal = this.cartService.calculatedSubTotal; // Đọc trực tiếp từ service
  getIcon = getNotificationTypeIcon;


  // --- Signals cho Dropdown Thông báo ---
  isNotificationDropdownOpen = signal(false);
  recentNotifications = signal<NotificationResponse[]>([]);
  isLoadingNotifications = signal(false);
  notificationError = signal<string | null>(null);

  // Các computed signal để kiểm tra role (ví dụ)
  isAdmin = computed(() => this.authService.hasRole('ROLE_ADMIN'));
  isFarmer = computed(() => this.authService.hasRole('ROLE_FARMER'));
  isBusinessBuyer = computed(() => this.authService.hasRole('ROLE_BUSINESS_BUYER'));
  isConsumer = computed(() => this.authService.hasRole('ROLE_CONSUMER'));


  isMobileSearchVisible = signal(false); // Signal mới

  // Tham chiếu đến input tìm kiếm mobile để focus
  @ViewChild('mobileSearchInput') mobileSearchInputRef?: ElementRef<HTMLInputElement>;

  constructor() {
    // Sử dụng effect để focus vào input khi nó hiển thị
    effect(() => {
      if (this.isMobileSearchVisible() && this.mobileSearchInputRef?.nativeElement) {
        // Dùng setTimeout nhỏ để đảm bảo input đã render xong trước khi focus
        setTimeout(() => this.mobileSearchInputRef?.nativeElement.focus(), 0);
      }
    });
  }

  ngAfterViewInit(): void {
    // Có thể không cần làm gì ở đây nếu dùng effect
  }

  toggleMobileSearch(): void {
    this.isMobileSearchVisible.update(visible => !visible);
  }

  performSearch(searchTerm: string): void {
    if (searchTerm?.trim()) {
      console.log('Performing search for:', searchTerm);
      this.isMobileSearchVisible.set(false); // Ẩn ô search sau khi tìm
      // TODO: Điều hướng đến trang kết quả tìm kiếm hoặc xử lý tìm kiếm
      this.router.navigate(['/products'], { queryParams: { keyword: searchTerm.trim() } });
    }
  }




  loadRecentNotifications(limit: number = 7): void {
    this.isLoadingNotifications.set(true);
    this.notificationError.set(null);
    this.notificationService.getMyNotifications(0, limit) // Lấy trang đầu, giới hạn số lượng
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingNotifications.set(false))
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.recentNotifications.set(res.data.content);
            // Có thể cập nhật lại unreadCount nếu API trả về số lượng mới nhất
            //this.notificationService.loadInitialUnreadCount(); // Hoặc cách khác
          } else {
            this.notificationError.set(res.message || 'Không tải được thông báo.');
            this.recentNotifications.set([]);
          }
        },
        error: (err) => {
          this.notificationError.set(err.message || 'Lỗi tải thông báo.');
          this.recentNotifications.set([]);
          console.error("Error loading recent notifications:", err);
        }
      });
  }

  // Đánh dấu đã đọc và điều hướng (nếu có link)
  markAsReadAndNavigate(notification: NotificationResponse, event: MouseEvent): void {
    event.stopPropagation(); // Ngăn dropdown đóng lại ngay lập tức
    this.closeNotificationDropdown(); // Đóng dropdown

    // Đánh dấu đã đọc (không cần chờ kết quả)
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.id).subscribe({
        // Cập nhật lại count trong service đã làm
        error: err => console.error("Error marking notification as read:", err)
      });
    }

    // Điều hướng nếu có link
    if (notification.link) {
      this.router.navigateByUrl(notification.link);
    }
  }

  markAllAsRead(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        // Cập nhật trạng thái isRead trong danh sách hiện tại
        this.recentNotifications.update(notifications =>
          notifications.map(n => ({ ...n, isRead: true }))
        );
        // Toastr thông báo thành công nếu muốn
      },
      error: err => console.error("Error marking all notifications as read:", err)
    });
  }

  closeNotificationDropdown(): void {
    this.isNotificationDropdownOpen.set(false);
  }

  trackNotificationById(index: number, item: NotificationResponse): number {
    return item.id; // Giả sử NotificationResponse có trường 'id'
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']); // Điều hướng về trang login sau khi logout
  }
}
