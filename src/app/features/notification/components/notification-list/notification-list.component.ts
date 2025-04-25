
import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { NotificationResponse } from '../../dto/response/NotificationResponse';
import { Page } from '../../../../core/models/page.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { getNotificationTypeIcon } from '../../../../common/model/notification-type.enum';
import {NotificationService} from '../../service/notification.service';
import {ToastrService} from 'ngx-toastr'; // Import helper

@Component({
  selector: 'app-notification-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LoadingSpinnerComponent,
    AlertComponent,
    PaginatorComponent,
    DatePipe,
    TimeAgoPipe,
    SafeHtmlPipe
  ],
  templateUrl: './notification-list.component.html',
})
export class NotificationListComponent implements OnInit, OnDestroy {
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();
  private toastr = inject(ToastrService);

  notificationsPage = signal<Page<NotificationResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  // Signal để theo dõi ID đang xóa (tránh double click)
  deletingNotificationId = signal<number | null>(null);

  // Phân trang
  currentPage = signal(0);
  pageSize = signal(15); // Số lượng lớn hơn cho trang riêng
  sort = signal('createdAt,desc');
  unreadCount = this.notificationService.unreadCount;
  // Helpers
  getIcon = getNotificationTypeIcon;

  ngOnInit(): void {
    this.loadNotifications();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadNotifications(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.notificationService.getMyNotifications(this.currentPage(), this.pageSize(), this.sort())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.notificationsPage.set(res.data);
            // Cập nhật lại count nếu cần (mặc dù service WS đã làm)
            this.notificationService.loadInitialUnreadCount();
          } else {
            this.errorMessage.set(res.message || 'Không tải được thông báo.');
            this.notificationsPage.set(null);
          }
        },
        error: (err) => {
          this.errorMessage.set(err.message || 'Lỗi tải thông báo.');
          this.notificationsPage.set(null);
          console.error("Error loading notifications:", err);
        }
      });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadNotifications();
  }

  markAsReadAndNavigate(notification: NotificationResponse): void {
    // Đánh dấu đã đọc ở backend
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.id).subscribe({
        next: () => {
          // Cập nhật trạng thái trong danh sách hiện tại mà không cần load lại
          this.notificationsPage.update(page => {
            if (!page) return null;
            const updatedContent = page.content.map(n =>
              n.id === notification.id ? { ...n, isRead: true } : n
            );
            return { ...page, content: updatedContent };
          });
        },
        error: err => console.error("Error marking notification as read:", err)
      });
    }
    // Điều hướng nếu có link
    if (notification.link) {
      this.router.navigateByUrl(notification.link);
    }
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        // Cập nhật trạng thái isRead trong danh sách hiện tại
        this.notificationsPage.update(page => {
          if (!page) return null;
          const updatedContent = page.content.map(n => ({ ...n, isRead: true }));
          return { ...page, content: updatedContent };
        });
      },
      error: err => console.error("Error marking all notifications as read:", err)
    });
  }

  // *** HOÀN THIỆN HÀM DELETE ***
  deleteNotification(notificationId: number, event: MouseEvent): void {
    event.stopPropagation(); // Ngăn sự kiện click lan tỏa lên thẻ <a> cha

    // Hỏi xác nhận người dùng
    if (confirm('Bạn có chắc chắn muốn xóa thông báo này?')) {
      this.deletingNotificationId.set(notificationId); // Đánh dấu đang xóa ID này
      this.errorMessage.set(null); // Xóa lỗi cũ

      this.notificationService.deleteNotification(notificationId)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => this.deletingNotificationId.set(null)) // Luôn bỏ đánh dấu khi hoàn thành/lỗi
        )
        .subscribe({
          next: (res) => {
            if (res.success) {
              this.toastr.success('Đã xóa thông báo.');
              // Cập nhật lại danh sách bằng cách loại bỏ item đã xóa
              this.notificationsPage.update(page => {
                if (!page) return null;
                const updatedContent = page.content.filter(n => n.id !== notificationId);
                // Cập nhật lại totalElements nếu cần (hoặc chỉ cần cập nhật content)
                return {
                  ...page,
                  content: updatedContent,
                  totalElements: page.totalElements - 1,
                  numberOfElements: updatedContent.length // Cập nhật số phần tử trang hiện tại
                };
              });
              // Có thể cần load lại nếu trang hiện tại trở nên trống sau khi xóa
              if (this.notificationsPage()?.content?.length === 0 && this.currentPage() > 0) {
                this.currentPage.update(p => p - 1); // Quay về trang trước
                this.loadNotifications();
              }
              // Cập nhật lại số lượng chưa đọc nếu thông báo bị xóa là chưa đọc
              this.notificationService.loadInitialUnreadCount();
            } else {
              this.handleError(res, 'Lỗi khi xóa thông báo.');
            }
          },
          error: (err) => this.handleError(err, 'Lỗi khi xóa thông báo.')
        });
    }
  }
  // ****************************

  // Helper xử lý lỗi
  private handleError(err: any, defaultMessage: string): void {
    const message = (err && typeof err === 'object' && 'message' in err && err.message) ? err.message : (err instanceof Error ? err.message : defaultMessage);
    this.errorMessage.set(message); // Có thể hiển thị lỗi chung
    this.toastr.error(message); // Hiển thị toast lỗi
    this.isLoading.set(false); // Tắt loading chính nếu có lỗi chung
    console.error("Error in NotificationListComponent:", err);
  }

  trackNotificationById(index: number, item: NotificationResponse): number {
    return item.id;
  }
}
