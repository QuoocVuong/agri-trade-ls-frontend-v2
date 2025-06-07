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
import {ChatService} from '../../../interaction/service/ChatService';
import {ModalComponent} from '../../../../shared/components/modal/modal.component';
import {AgreedOrderFormComponent} from '../agreed-order-form/agreed-order-form.component';
import {OrderResponse} from '../../../ordering/dto/response/OrderResponse';
import {getMassUnitText} from '../../../catalog/domain/mass-unit.enum';
import {
  FinalizeSupplyRequestModalComponent
} from '../finalize-supply-request-modal/finalize-supply-request-modal.component'; // Import TimeAgoPipe

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
    TimeAgoPipe,
    ModalComponent,
    AgreedOrderFormComponent,
    FinalizeSupplyRequestModalComponent,
    // Thêm TimeAgoPipe
  ],
  templateUrl: './manage-supply-requests.component.html',
})
export class ManageSupplyRequestsComponent implements OnInit, OnDestroy {
  private requestService = inject(SupplyOrderRequestService);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();
  // Inject ChatService
  private chatService = inject(ChatService);

  requestsPage = signal<PageData<SupplyOrderRequestResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
 // actionLoadingMap = signal<{[requestId: number]: boolean}>({}); // Để theo dõi loading cho từng request

  currentPage = signal(0);
  pageSize = signal(10);
  sort = signal('createdAt,desc'); // Sắp xếp theo ngày tạo mới nhất

  // Signals cho modal xem chi tiết
  selectedRequestDetail = signal<SupplyOrderRequestResponse | null>(null);
  showViewRequestModal = signal(false);

  // Signals cho modal chốt đơn hàng
  requestToFinalize = signal<SupplyOrderRequestResponse | null>(null);
  showFinalizeOrderModal = signal(false);


  // Sửa lại actionLoadingMap để có thể chứa các loại action khác nhau
  actionLoadingMap = signal<{[requestId: number]: 'accept' | 'reject' | boolean}>({});


  // Helpers cho template
  RequestStatusEnum = SupplyOrderRequestStatus;
  getStatusText = getSupplyOrderRequestStatusText;
  getUnitText = getMassUnitText;


  // Không cần gán getStatusText vào biến nữa nếu template gọi trực tiếp với tham số
  // getStatusText = getSupplyOrderRequestStatusText;
  getStatusClass = getSupplyOrderRequestStatusCssClass;

  // Thêm một phương thức helper trong component để gọi getSupplyOrderRequestStatusText
  // với ngữ cảnh là Farmer
  getFarmerViewStatusText(status: SupplyOrderRequestStatus | string | null | undefined): string {
    return getSupplyOrderRequestStatusText(status, true); // Luôn truyền true vì đây là view của Farmer
  }


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

  // rejectRequest(requestId: number): void {
  //   if (this.actionLoadingMap()[requestId]) return;
  //
  //   const reason = prompt('Nhập lý do từ chối (nếu có):');
  //   // Nếu người dùng nhấn Cancel trên prompt, reason sẽ là null
  //
  //   this.setActionLoading(requestId, true);
  //   this.requestService.rejectRequest(requestId, reason || undefined)
  //     .pipe(
  //       takeUntil(this.destroy$),
  //       finalize(() => this.setActionLoading(requestId, false))
  //     )
  //     .subscribe({
  //       next: (res) => {
  //         if (res.success) {
  //           this.toastr.info('Đã từ chối yêu cầu đặt hàng.');
  //           this.loadReceivedRequests(); // Tải lại danh sách
  //         } else {
  //           this.toastr.error(res.message || 'Từ chối yêu cầu thất bại.');
  //         }
  //       },
  //       error: (err) => {
  //         this.toastr.error(err.error?.message || 'Lỗi khi từ chối yêu cầu.');
  //       }
  //     });
  // }

  // startChatWithBuyer(buyerId: number | undefined, buyerName?: string | null, contextProductId?: number, contextProductName?: string): void {
  //   if (!buyerId) {
  //     this.toastr.error('Không tìm thấy thông tin người mua.');
  //     return;
  //   }
  //   this.chatService.getOrCreateChatRoom(buyerId) // Giả sử ChatService đã được inject
  //     .pipe(takeUntil(this.destroy$))
  //     .subscribe({
  //       next: (res) => {
  //         if (res.success && res.data?.id) {
  //           const queryParams: any = { roomId: res.data.id };
  //           if (contextProductId && contextProductName) {
  //             queryParams.contextProductId = contextProductId;
  //             queryParams.contextProductName = contextProductName;
  //             // queryParams.contextProductSlug = ... ; // Nếu có slug
  //           }
  //           this.router.navigate(['/chat'], { queryParams });
  //         } else {
  //           this.toastr.error(res.message || 'Không thể bắt đầu cuộc trò chuyện.');
  //         }
  //       },
  //       error: (err) => this.toastr.error(err.error?.message || 'Lỗi khi mở chat.')
  //     });
  // }



  // private setActionLoading(requestId: number, isLoading: boolean): void {
  //   this.actionLoadingMap.update(map => ({ ...map, [requestId]: isLoading }));
  // }

  trackRequestById(index: number, item: SupplyOrderRequestResponse): number {
    return item.id;
  }

  startChatWithBuyer(request: SupplyOrderRequestResponse): void { // Nhận cả object request
    if (!request.buyer?.id) {
      this.toastr.error('Không tìm thấy thông tin người mua.');
      return;
    }
    this.chatService.getOrCreateChatRoom(request.buyer.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data?.id) {
            const queryParams: any = { roomId: res.data.id };
            if (request.product?.id && request.product?.name) {
              queryParams.contextProductId = request.product.id;
              queryParams.contextProductName = `Yêu cầu cho: ${request.product.name}`;
              if (request.product.slug) queryParams.contextProductSlug = request.product.slug;
            }
            this.router.navigate(['/chat'], { queryParams });
          } else {
            this.toastr.error(res.message || 'Không thể bắt đầu cuộc trò chuyện.');
          }
        },
        error: (err) => this.toastr.error(err.error?.message || 'Lỗi khi mở chat.')
      });
  }

  // Mở modal xem chi tiết
  openViewRequestModal(request: SupplyOrderRequestResponse): void {
    this.selectedRequestDetail.set(request);
    this.showViewRequestModal.set(true);
  }

  closeViewRequestModal(): void {
    this.showViewRequestModal.set(false);
  }

  // Mở modal để Farmer chốt đơn hàng
  openFinalizeOrderModal(request: SupplyOrderRequestResponse): void {
    if (request.status !== SupplyOrderRequestStatus.PENDING_FARMER_ACTION &&
      request.status !== SupplyOrderRequestStatus.NEGOTIATING) {
      this.toastr.warning('Yêu cầu này không còn ở trạng thái có thể chấp nhận.');
      return;
    }
    this.requestToFinalize.set(request);
    this.showFinalizeOrderModal.set(true);
  }

  closeFinalizeOrderModal(): void {
    this.showFinalizeOrderModal.set(false);
    this.requestToFinalize.set(null); // Reset
  }
  // Xử lý khi AgreedOrderFormComponent được submit thành công từ modal
  handleAgreedOrderSubmitted(createdOrder: OrderResponse | null): void {
    if (createdOrder && this.requestToFinalize()) {
      this.toastr.success(`Đã tạo đơn hàng thỏa thuận #${createdOrder.orderCode} thành công.`);
      // Cập nhật trạng thái của SupplyOrderRequest gốc thành FARMER_ACCEPTED
      const originalRequestId = this.requestToFinalize()!.id;
      this.setActionLoading(originalRequestId, 'accept'); // Có thể dùng loading chung hoặc riêng

      // Gọi API để cập nhật trạng thái SupplyOrderRequest (nếu backend không tự làm khi tạo Order)
      // Hoặc đơn giản là tải lại danh sách
      this.requestService.acceptRequest(originalRequestId) // Giả sử có API này
        .pipe(finalize(() => this.setActionLoading(originalRequestId, false)))
        .subscribe({
          next: () => this.loadReceivedRequests(),
          error: () => this.loadReceivedRequests() // Vẫn load lại nếu lỗi cập nhật status
        });

    } else if (!createdOrder) {
      // Trường hợp form bị hủy hoặc có lỗi từ AgreedOrderFormComponent
      this.toastr.info('Việc tạo đơn hàng thỏa thuận đã được hủy hoặc có lỗi.');
    }
    this.closeFinalizeOrderModal();
  }


  rejectRequest(requestId: number): void {
    if (this.actionLoadingMap()[requestId]) return;
    const requestToReject = this.requestsPage()?.content.find(r => r.id === requestId);
    if (!requestToReject) return;

    if (requestToReject.status !== SupplyOrderRequestStatus.PENDING_FARMER_ACTION &&
      requestToReject.status !== SupplyOrderRequestStatus.NEGOTIATING) {
      this.toastr.warning('Không thể từ chối yêu cầu ở trạng thái này.');
      return;
    }

    const reason = prompt('Nhập lý do từ chối (nếu có):');
    this.setActionLoading(requestId, 'reject');
    this.requestService.rejectRequest(requestId, reason || undefined)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.setActionLoading(requestId, false))
      )
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.toastr.info('Đã từ chối yêu cầu đặt hàng.');
            this.loadReceivedRequests();
          } else {
            this.toastr.error(res.message || 'Từ chối yêu cầu thất bại.');
          }
        },
        error: (err) => this.toastr.error(err.error?.message || 'Lỗi khi từ chối yêu cầu.')
      });
  }

  private setActionLoading(requestId: number, action: 'accept' | 'reject' | boolean): void {
    this.actionLoadingMap.update(map => ({ ...map, [requestId]: action }));
  }

}
