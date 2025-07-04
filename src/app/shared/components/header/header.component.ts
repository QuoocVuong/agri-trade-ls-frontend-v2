import {
  AfterViewInit,
  Component,
  computed, effect,
  ElementRef,
  EventEmitter,
  inject, Input,
  Output,
  signal,
  ViewChild
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {CommonModule, DatePipe} from '@angular/common';
import {NotificationService} from '../../../features/notification/service/notification.service';
import {CartService} from '../../../features/ordering/services/cart.service';
import {FormatBigDecimalPipe} from '../../pipes/format-big-decimal.pipe';
import {Subject} from 'rxjs';
import {NotificationResponse} from '../../../features/notification/dto/response/NotificationResponse';
import {finalize, takeUntil} from 'rxjs/operators';

import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import {LoadingSpinnerComponent} from '../loading-spinner/loading-spinner.component';
import {AlertComponent} from '../alert/alert.component';
import {getNotificationTypeIcon} from '../../../common/model/notification-type.enum';

import {ThemeService} from '../../../core/services/theme.service';
import {SidebarService} from '../../../core/services/sidebar.service';


@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, FormatBigDecimalPipe, DatePipe, TimeAgoPipe, LoadingSpinnerComponent, AlertComponent],
  templateUrl: './header.component.html',
})
export class HeaderComponent implements AfterViewInit {

  @Input() showSidebarToggle: boolean = true; // Mặc định là true (cho các layout có sidebar)

  private authService = inject(AuthService);
  private router = inject(Router);
  private cartService = inject(CartService);
  private notificationService = inject(NotificationService);
  private themeService = inject(ThemeService);
  private destroy$ = new Subject<void>();
  public sidebarService = inject(SidebarService);

  // Thêm signal để theo dõi trạng thái mở của sidebar từ service
  isSidebarCurrentlyOpen = this.sidebarService.isOpen;

  isHeaderDropdownOpen = signal(false); // Signal cho menu dropdown của header (cho public layout)



  // Sử dụng signal từ AuthService để biết trạng thái đăng nhập và thông tin user
  isLoggedIn = this.authService.isAuthenticated; // Giả sử AuthService có signal này
  user = this.authService.currentUser; // Giả sử AuthService có signal này
  // Lấy signal số lượng từ các service
  cartItemCount = this.cartService.totalItems; // <-- Lấy signal từ CartService
  unreadNotificationCount = this.notificationService.unreadCount; // <-- Lấy signal từ NotificationService

  cartSubTotal = this.cartService.calculatedSubTotal; // Đọc trực tiếp từ service
  getIcon = getNotificationTypeIcon;

  isDarkMode = false; // Property to track dark mode state


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
  @ViewChild('desktopSearchInput') desktopSearchInputRef?: ElementRef<HTMLInputElement>;

  constructor() {
    // Sử dụng effect để focus vào input khi nó hiển thị
    effect(() => {
      this.themeService.darkMode$.subscribe(isDark => {
        this.isDarkMode = isDark;
      });
      if (this.isMobileSearchVisible() && this.mobileSearchInputRef?.nativeElement) {
        // Dùng setTimeout nhỏ để đảm bảo input đã render xong trước khi focus
        setTimeout(() => this.mobileSearchInputRef?.nativeElement.focus(), 0);
      }
    });
  }

  ngAfterViewInit(): void {
    // Có thể không cần làm gì ở đây nếu dùng effect
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  handleMobileMenuToggle(): void {
    if (this.showSidebarToggle) { // Nếu layout này có sidebar (ví dụ: dashboard)
      this.sidebarService.toggle();
      this.isHeaderDropdownOpen.set(false); // Đảm bảo dropdown header đóng
    } else { // Nếu layout này không có sidebar (ví dụ: public layout/trang chủ)
      this.isHeaderDropdownOpen.update(v => !v);
    }
  }

  closeHeaderDropdown(): void {
    this.isHeaderDropdownOpen.set(false);
  }

  toggleMobileSearch(): void {
    this.isMobileSearchVisible.update(visible => !visible);
  }

  toggleDarkMode(): void {
    this.themeService.toggleDarkMode();
  }

  performSearch(searchTerm: string): void {
    if (searchTerm?.trim()) {
      this.isMobileSearchVisible.set(false); // Ẩn ô search mobile
      if (this.desktopSearchInputRef) { // Xóa input desktop nếu có
        this.desktopSearchInputRef.nativeElement.value = '';
      }
      // TODO: Điều hướng đến trang kết quả tìm kiếm hoặc xử lý tìm kiếm
      //this.router.navigate(['/supply-sources'], { queryParams: { productKeyword: searchTerm.trim() } });
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
    this.sidebarService.close(); // Đóng sidebar nếu đang mở
    this.isHeaderDropdownOpen.set(false); // Đóng dropdown header nếu đang mở
    this.router.navigate(['/auth/login']); // Điều hướng về trang login sau khi logout
  }
}
