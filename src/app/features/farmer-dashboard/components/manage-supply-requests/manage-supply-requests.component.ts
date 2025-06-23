
import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

import { SupplyOrderRequestService } from '../../../ordering/services/supply-order-request.service';
import { SupplyOrderRequestResponse } from '../../../ordering/dto/response/SupplyOrderRequestResponse';
import { PageData } from '../../../../core/models/api-response.model';
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
} from '../finalize-supply-request-modal/finalize-supply-request-modal.component';
import {FormBuilder, ReactiveFormsModule} from '@angular/forms';

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
    ReactiveFormsModule

  ],
  templateUrl: './manage-supply-requests.component.html',
})
export class ManageSupplyRequestsComponent implements OnInit, OnDestroy {
  private requestService = inject(SupplyOrderRequestService);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();

  private chatService = inject(ChatService);
  private fb = inject(FormBuilder);

  requestsPage = signal<PageData<SupplyOrderRequestResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);


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
  // RequestStatusEnum = SupplyOrderRequestStatus;
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

  // Thêm các thuộc tính cho bộ lọc
  filterForm = this.fb.group({
    status: ['']
  });
  RequestStatusEnum = SupplyOrderRequestStatus;
  requestStatuses = Object.values(SupplyOrderRequestStatus);




  ngOnInit(): void {
    this.loadReceivedRequests(); // Load lần đầu

    // Lắng nghe thay đổi của form để load lại
    this.filterForm.get('status')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage.set(0); // Reset về trang đầu khi lọc
      this.loadReceivedRequests();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadReceivedRequests(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const status = this.filterForm.get('status')?.value as SupplyOrderRequestStatus | null;

    this.requestService.getMyReceivedRequests(this.currentPage(), this.pageSize(), this.sort(), status)
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

      // Gọi API để cập nhật trạng thái SupplyOrderRequest
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
