// src/app/core/services/notification.service.ts (Ví dụ)
import { Injectable, signal, inject, OnDestroy, effect } from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';

import { RxStomp } from '@stomp/rx-stomp'; // Import RxStomp
import { IMessage } from '@stomp/stompjs';
import {Observable, Subject, throwError} from 'rxjs';
import { takeUntil, catchError, tap } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import {environment} from '../../../../environments/environment';
import {AuthService} from '../../../core/services/auth.service';
import {ApiResponse, PagedApiResponse} from '../../../core/models/api-response.model';
import {NotificationResponse} from '../dto/response/NotificationResponse'; // Để hiển thị toast

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private toastr = inject(ToastrService);
  private apiUrl = `${environment.apiUrl}/notifications`;
  private wsUrl = environment.wsUrl;
  private destroy$ = new Subject<void>();

  // Signal chứa số lượng thông báo chưa đọc
  private unreadCountSignal = signal<number>(0);
  public readonly unreadCount = this.unreadCountSignal.asReadonly(); // Public readonly signal

  // WebSocket Client
  private rxStomp: RxStomp;

  constructor() {
    this.rxStomp = new RxStomp();

    // Lắng nghe trạng thái đăng nhập
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.loadInitialUnreadCount(); // Lấy số lượng ban đầu khi login
        this.configureAndConnectWebSocket(); // Kết nối WS
      } else {
        this.disconnectWebSocket();
        this.unreadCountSignal.set(0); // Reset khi logout
      }
    }, { allowSignalWrites: true });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnectWebSocket();
  }

  // Lấy số lượng chưa đọc ban đầu từ API
  loadInitialUnreadCount(): void {
    this.http.get<ApiResponse<number>>(`${this.apiUrl}/my/unread-count`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && typeof res.data === 'number') {
            this.unreadCountSignal.set(res.data);
          }
        },
        error: (err) => console.error("Error loading unread notification count:", err)
      });
  }

  // Cấu hình và kết nối WebSocket
  private configureAndConnectWebSocket(): void {
    if (this.rxStomp.active) return; // Đã kết nối

    this.rxStomp.configure({
      brokerURL: this.wsUrl,
      connectHeaders: { Authorization: `Bearer ${this.authService.getToken() || ''}` },
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      reconnectDelay: 5000,
      debug: (str) => { console.log('Notification STOMP: ' + str); },
    });

    this.rxStomp.activate();

    // Lắng nghe thông báo mới từ queue '/user/queue/notifications'
    this.rxStomp.watch(`/user/queue/notifications`)
      .pipe(takeUntil(this.destroy$))
      .subscribe((message: IMessage) => {
        try {
          const notification: NotificationResponse = JSON.parse(message.body);
          console.log("Received new notification via WS:", notification);
          // Tăng số lượng chưa đọc
          this.unreadCountSignal.update(count => count + 1);
          // Hiển thị toast thông báo
          this.toastr.info(notification.message, 'Thông báo mới', {
            closeButton: true,
            timeOut: 10000, // 10 giây
            // Có thể thêm hành động khi click toast để điều hướng đến link
            // onTap: () => { if (notification.link) this.router.navigateByUrl(notification.link); }
          });
        } catch (e) {
          console.error("Error parsing incoming notification WS message:", e);
        }
      });
  }

  private disconnectWebSocket(): void {
    if (this.rxStomp.active) {
      this.rxStomp.deactivate();
      console.log("Notification WebSocket disconnected.");
    }
  }

  // Các phương thức khác để gọi API đánh dấu đã đọc, xóa... (nếu cần)
  markAsRead(notificationId: number): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/${notificationId}/read`, {}).pipe(
      tap(() => this.loadInitialUnreadCount()) // Load lại count sau khi đánh dấu đọc
    );
  }

  markAllAsRead(): Observable<ApiResponse<void>> {

    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/my/read-all`, {}).pipe(
      tap(() => this.unreadCountSignal.set(0)) // Reset count ngay lập tức
    );
  }

  // *** THÊM PHƯƠNG THỨC NÀY ***
  /**
   * Lấy danh sách thông báo gần đây của người dùng (phân trang).
   * @param page Trang cần lấy (mặc định 0).
   * @param size Số lượng trên mỗi trang (mặc định 5-10).
   * @param sort Sắp xếp (mặc định theo ngày tạo giảm dần).
   */
  getMyNotifications(page: number = 0, size: number = 7, sort: string = 'createdAt,desc'): Observable<PagedApiResponse<NotificationResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);
    return this.http.get<PagedApiResponse<NotificationResponse>>(`${this.apiUrl}/my`, { params });
  }
  // *****************************


  // *** THÊM PHƯƠNG THỨC DELETE ***
  /**
   * Xóa một thông báo cụ thể của người dùng hiện tại.
   * Gọi API: DELETE /api/notifications/{notificationId}
   * @param notificationId ID của thông báo cần xóa.
   */
  deleteNotification(notificationId: number): Observable<ApiResponse<void>> {
    // API backend sẽ kiểm tra quyền sở hữu dựa trên user đã xác thực
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${notificationId}`).pipe(
      tap(() => {
        // Giảm số lượng chưa đọc nếu thông báo bị xóa là chưa đọc
        // Cách đơn giản là gọi lại API đếm, hoặc xử lý phức tạp hơn ở client
        this.loadInitialUnreadCount();
      }),
      catchError(err => {
        console.error(`Error deleting notification ${notificationId}:`, err);
        // Ném lại lỗi để component có thể xử lý
        return throwError(() => err); // Import throwError từ 'rxjs' nếu chưa có
      })
    );
  }
  // *****************************
}
