// src/app/features/farmer-dashboard/components/manage-supply-requests/manage-supply-requests.component.ts
import { Component, OnInit, inject, signal, OnDestroy, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

import { SupplyOrderRequestService } from '../../../ordering/services/supply-order-request.service';
import { SupplyOrderRequestResponse } from '../../../ordering/dto/response/SupplyOrderRequestResponse';
import { PageData, PagedApiResponse } from '../../../../core/models/api-response.model';
import { SupplyOrderRequestStatus, getSupplyOrderRequestStatusText } from '../../../ordering/domain/supply-order-request-status.enum';

import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import {ChatService} from '../../../interaction/service/ChatService'; // Import TimeAgoPipe

@Component({
  selector: 'app-manage-supply-requests',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LoadingSpinnerComponent,
    AlertComponent,
    PaginatorComponent,
    DatePipe,
    FormatBigDecimalPipe,
    TimeAgoPipe // Thêm TimeAgoPipe
  ],
  templateUrl: './manage-supply-requests.component.html',
})
export class ManageSupplyRequestsComponent implements OnInit, OnDestroy {
  private requestService = inject(SupplyOrderRequestService);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();

  requestsPage = signal<PageData<SupplyOrderRequestResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  actionLoadingMap = signal<{[requestId: number]: boolean}>({}); // Để theo dõi loading cho từng request

  currentPage = signal(0);
  pageSize = signal(10);
  sort = signal('createdAt,desc'); // Sắp xếp theo ngày tạo mới nhất

  // Helpers cho template
  RequestStatusEnum = SupplyOrderRequestStatus;
  getStatusText = getSupplyOrderRequestStatusText;

  constructor() {
    effect(() => {
      this.loadReceivedRequests();
    });
  }

  ngOnInit(): void {
    // Không cần gọi load ở đây vì effect sẽ làm
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadReceivedRequests(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.requestService.getMyReceivedRequests(this.currentPage(), this.pageSize(), this.sort())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.requestsPage.set(res.data);
          } else {
            this.requestsPage.set(null);
            this.errorMessage.set(res.message || 'Không tải được danh sách yêu cầu.');
          }
        },
        error: (err) => {
          this.requestsPage.set(null);
          this.errorMessage.set(err.error?.message || 'Lỗi khi tải danh sách yêu cầu.');
        }
      });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  viewRequestDetails(requestId: number): void {
    // Hiện tại chưa có trang chi tiết riêng cho SupplyOrderRequest,
    // có thể điều hướng đến chat hoặc hiển thị modal.
    // Hoặc nếu có trang chi tiết:
    // this.router.navigate(['/farmer/supply-requests', requestId]);
    this.toastr.info(`Xem chi tiết yêu cầu #${requestId} (chức năng đang phát triển).`);
  }

  acceptRequest(requestId: number): void {
    if (this.actionLoadingMap()[requestId]) return;

    if (!confirm('Bạn có chắc chắn muốn chấp nhận yêu cầu này và tạo đơn hàng không?')) {
      return;
    }
    this.setActionLoading(requestId, true);
    this.requestService.acceptRequest(requestId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.setActionLoading(requestId, false))
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.toastr.success(`Đã chấp nhận yêu cầu và tạo đơn hàng #${res.data.orderCode}.`);
            this.loadReceivedRequests(); // Tải lại danh sách để cập nhật trạng thái
            // Điều hướng đến chi tiết đơn hàng vừa tạo
            this.router.navigate(['/farmer/orders', res.data.id]);
          } else {
            this.toastr.error(res.message || 'Chấp nhận yêu cầu thất bại.');
          }
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Lỗi khi chấp nhận yêu cầu.');
        }
      });
  }

  rejectRequest(requestId: number): void {
    if (this.actionLoadingMap()[requestId]) return;

    const reason = prompt('Nhập lý do từ chối (nếu có):');
    // Nếu người dùng nhấn Cancel trên prompt, reason sẽ là null

    this.setActionLoading(requestId, true);
    this.requestService.rejectRequest(requestId, reason || undefined)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.setActionLoading(requestId, false))
      )
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.toastr.info('Đã từ chối yêu cầu đặt hàng.');
            this.loadReceivedRequests(); // Tải lại danh sách
          } else {
            this.toastr.error(res.message || 'Từ chối yêu cầu thất bại.');
          }
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Lỗi khi từ chối yêu cầu.');
        }
      });
  }

  startChatWithBuyer(buyerId: number | undefined, buyerName?: string | null, contextProductId?: number, contextProductName?: string): void {
    if (!buyerId) {
      this.toastr.error('Không tìm thấy thông tin người mua.');
      return;
    }
    this.chatService.getOrCreateChatRoom(buyerId) // Giả sử ChatService đã được inject
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data?.id) {
            const queryParams: any = { roomId: res.data.id };
            if (contextProductId && contextProductName) {
              queryParams.contextProductId = contextProductId;
              queryParams.contextProductName = contextProductName;
              // queryParams.contextProductSlug = ... ; // Nếu có slug
            }
            this.router.navigate(['/chat'], { queryParams });
          } else {
            this.toastr.error(res.message || 'Không thể bắt đầu cuộc trò chuyện.');
          }
        },
        error: (err) => this.toastr.error(err.error?.message || 'Lỗi khi mở chat.')
      });
  }
  // Inject ChatService
  private chatService = inject(ChatService);


  private setActionLoading(requestId: number, isLoading: boolean): void {
    this.actionLoadingMap.update(map => ({ ...map, [requestId]: isLoading }));
  }

  trackRequestById(index: number, item: SupplyOrderRequestResponse): number {
    return item.id;
  }
}
