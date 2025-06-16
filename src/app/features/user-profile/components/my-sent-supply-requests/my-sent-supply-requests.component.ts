// src/app/features/user-profile/components/my-sent-supply-requests/my-sent-supply-requests.component.ts
import { Component, OnInit, inject, signal, OnDestroy, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {Router, RouterLink} from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { SupplyOrderRequestService } from '../../../ordering/services/supply-order-request.service';
import { SupplyOrderRequestResponse } from '../../../ordering/dto/response/SupplyOrderRequestResponse';
import { PageData, PagedApiResponse } from '../../../../core/models/api-response.model';
import {
  SupplyOrderRequestStatus,
  getSupplyOrderRequestStatusText,
  getSupplyOrderRequestStatusCssClass
} from '../../../ordering/domain/supply-order-request-status.enum';

import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import {ModalComponent} from '../../../../shared/components/modal/modal.component';
import {getMassUnitText} from '../../../catalog/domain/mass-unit.enum';
import {ChatService} from '../../../interaction/service/ChatService';
import {ToastrService} from 'ngx-toastr';
import {AuthService} from '../../../../core/services/auth.service';
import {FormBuilder, ReactiveFormsModule} from '@angular/forms';
import {ConfirmationService} from '../../../../shared/services/confirmation.service';

@Component({
  selector: 'app-my-sent-supply-requests',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LoadingSpinnerComponent,
    AlertComponent,
    PaginatorComponent,
    DatePipe,
    FormatBigDecimalPipe,
    TimeAgoPipe,
    ModalComponent,
    ReactiveFormsModule
  ],
  templateUrl: './my-sent-supply-requests.component.html',
})
export class MySentSupplyRequestsComponent implements OnInit, OnDestroy {
  private requestService = inject(SupplyOrderRequestService);
  private destroy$ = new Subject<void>();
  private chatService = inject(ChatService);
  private toastr = inject(ToastrService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private confirmationService = inject(ConfirmationService);

  requestsPage = signal<PageData<SupplyOrderRequestResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  currentPage = signal(0);
  pageSize = signal(10);
  sort = signal('createdAt,desc');

  getStatusText = getSupplyOrderRequestStatusText;

  getUnitText = getMassUnitText;
  getStatusClass = getSupplyOrderRequestStatusCssClass; // Expose hàm mới

  // Thêm một phương thức helper trong component để gọi getSupplyOrderRequestStatusText
  // với ngữ cảnh là Buyer
  getBuyerViewStatusText(status: SupplyOrderRequestStatus | string | null | undefined): string {
    return getSupplyOrderRequestStatusText(status, false); // Luôn truyền false (hoặc không truyền)
  }


  selectedRequestDetail = signal<SupplyOrderRequestResponse | null>(null);
  showDetailModal = signal(false);
  actionLoadingMap = signal<{[requestId: number]: boolean}>({}); // Để theo dõi loading cho từng request

  // Thêm các thuộc tính cho bộ lọc
  filterForm = this.fb.group({
    status: ['']
  });
  RequestStatusEnum = SupplyOrderRequestStatus;
  requestStatuses = Object.values(SupplyOrderRequestStatus);




  viewRequestDetailsModal(request: SupplyOrderRequestResponse): void {
    this.selectedRequestDetail.set(request);
    this.showDetailModal.set(true);
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
    // Không cần reset selectedRequestDetail ngay, nó sẽ tự mất khi modal đóng
    // Hoặc this.selectedRequestDetail.set(null); nếu muốn
  }

  private setActionLoading(requestId: number, isLoading: boolean): void {
    this.actionLoadingMap.update(map => ({ ...map, [requestId]: isLoading }));
  }

  // ... trong class MySentSupplyRequestsComponent ...

  cancelRequest(requestId: number, productName?: string | null): void {
    if (this.actionLoadingMap()[requestId]) return;

    const confirmMessage = productName
      ? `Bạn có chắc chắn muốn hủy yêu cầu đặt hàng cho nguồn cung "${productName}" không?`
      : `Bạn có chắc chắn muốn hủy yêu cầu này không?`;

    this.confirmationService.open({
      title: 'Xác Nhận Hủy Yêu Cầu',
      message: confirmMessage,
      confirmText: 'Đồng ý hủy',
      cancelText: 'Không',
      confirmButtonClass: 'btn-warning', // Dùng màu vàng cho hành động cần cân nhắc
      iconClass: 'fas fa-question-circle',
      iconColorClass: 'text-warning'
    }).subscribe(confirmed => {
      if (confirmed) {
        this.setActionLoading(requestId, true);
        this.errorMessage.set(null); // Xóa lỗi cũ nếu có

        this.requestService.cancelMySentRequest(requestId) // Gọi service
          .pipe(
            takeUntil(this.destroy$),
            finalize(() => this.setActionLoading(requestId, false))
          )
          .subscribe({
            next: (res) => {
              if (res.success) {
                this.toastr.success('Đã hủy yêu cầu thành công.');
                this.loadSentRequests(); // Tải lại danh sách để cập nhật trạng thái
              } else {
                this.toastr.error(res.message || 'Hủy yêu cầu thất bại.');
                this.errorMessage.set(res.message || 'Hủy yêu cầu thất bại.');
              }
            },
            error: (err) => {
              this.toastr.error(err.error?.message || 'Lỗi khi hủy yêu cầu.');
              this.errorMessage.set(err.error?.message || 'Lỗi khi hủy yêu cầu.');
              console.error('Error cancelling supply request:', err);
            }
          });
      }
      // Nếu `confirmed` là false, không làm gì cả.
    });

  }


  // constructor() {
  //   effect(() => {
  //     this.loadSentRequests();
  //   });
  // }

  ngOnInit(): void {
    this.loadSentRequests();

    this.filterForm.get('status')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage.set(0);
      this.loadSentRequests();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSentRequests(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const status = this.filterForm.get('status')?.value as SupplyOrderRequestStatus | null;
    this.requestService.getMySentRequests(this.currentPage(), this.pageSize(), this.sort(), status)
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
            this.errorMessage.set(res.message || 'Không tải được danh sách yêu cầu đã gửi.');
          }
        },
        error: (err) => {
          this.requestsPage.set(null);
          this.errorMessage.set(err.error?.message || 'Lỗi khi tải danh sách yêu cầu.');
        }
      });
  }

  startChatWithFarmer(
    farmerId: number | undefined,
    farmerName?: string | null,
    contextProductId?: number, // ID của sản phẩm trong SupplyOrderRequest
    contextProductName?: string | null
  ): void {
    if (!farmerId) {
      this.toastr.error('Không tìm thấy thông tin nhà cung cấp để bắt đầu chat.');
      return;
    }

    // Buyer không thể chat với chính mình (trường hợp này ít xảy ra ở đây nhưng vẫn nên có)
    const currentUserId = this.authService.currentUser()?.id;
    if (currentUserId && currentUserId === farmerId) {
      this.toastr.info('Bạn không thể tự chat với chính mình.');
      return;
    }

    this.toastr.info(`Đang mở cuộc trò chuyện với ${farmerName || 'Nhà cung cấp'}...`);
    // (Optional: Thêm signal loading cho nút chat nếu cần)

    this.chatService.getOrCreateChatRoom(farmerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data?.id) {
            const queryParams: any = { roomId: res.data.id };
            // Truyền thông tin sản phẩm của SupplyOrderRequest làm context cho chat
            if (contextProductId && contextProductName) {
              queryParams.contextProductId = contextProductId;
              queryParams.contextProductName = `Yêu cầu cho: ${contextProductName}`; // Thêm tiền tố để rõ ràng
              // queryParams.contextProductSlug = this.selectedRequestDetail()?.product?.slug; // Nếu có slug
            }
            this.router.navigate(['/chat'], { queryParams });
          } else {
            this.toastr.error(res.message || 'Không thể bắt đầu cuộc trò chuyện.');
          }
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Lỗi khi mở cửa sổ chat.');
          console.error('Error starting chat from sent requests:', err);
        }
      });
  }


  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  trackRequestById(index: number, item: SupplyOrderRequestResponse): number {
    return item.id;
  }
}
