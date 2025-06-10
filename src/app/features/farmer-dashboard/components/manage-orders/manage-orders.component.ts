import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import {ReactiveFormsModule, FormBuilder, FormControl, Validators} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Page } from '../../../../core/models/page.model';
import { OrderSummaryResponse } from '../../../ordering/dto/response/OrderSummaryResponse';
import { OrderResponse } from '../../../ordering/dto/response/OrderResponse'; // Import OrderResponse
import {FarmerOrderSearchParams, OrderService} from '../../../ordering/services/order.service';
import { OrderStatusUpdateRequest } from '../../../ordering/dto/request/OrderStatusUpdateRequest'; // Import DTO
import { ApiResponse, PagedApiResponse } from '../../../../core/models/api-response.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component'; // Import Modal
import { OrderStatus, getOrderStatusText, getOrderStatusCssClass } from '../../../ordering/domain/order-status.enum';
import { PaymentStatus, getPaymentStatusText, getPaymentStatusCssClass } from '../../../ordering/domain/payment-status.enum';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil, finalize } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import {FormatBigDecimalPipe} from '../../../../shared/pipes/format-big-decimal.pipe';
import {getPaymentMethodText, PaymentMethod} from '../../../ordering/domain/payment-method.enum';
import {getOrderTypeText, OrderType} from '../../../ordering/domain/order-type.enum'; // Import AuthService

@Component({
  selector: 'app-manage-orders',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LoadingSpinnerComponent, AlertComponent, PaginatorComponent, ModalComponent, DatePipe, DecimalPipe, FormatBigDecimalPipe],
  templateUrl: './manage-orders.component.html',
})
export class ManageOrdersComponent implements OnInit, OnDestroy {
  private orderService = inject(OrderService);
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private router = inject(Router);
  private authService = inject(AuthService); // Inject AuthService
  private destroy$ = new Subject<void>();

  ordersPage = signal<Page<OrderSummaryResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  // Filter form
  filterForm = this.fb.group({
    keyword: [''], // Tìm theo mã đơn hàng, tên người mua?
    status: [''], // Lọc theo OrderStatus
    paymentMethod: [''], // Lọc theo paymentMethod
    paymentStatus: [''],
    orderType: ['']

  });

  // Phân trang & Sắp xếp
  currentPage = signal(0);
  pageSize = signal(15);
  sort = signal('createdAt,desc');

  // Lấy danh sách OrderStatus để hiển thị trong dropdown filter
  orderStatuses = Object.values(OrderStatus);
  getOrderStatusText = getOrderStatusText;
  getStatusClass = getOrderStatusCssClass;
  getPaymentStatusText = getPaymentStatusText; // Import và dùng nếu cần hiển thị PaymentStatus
  getPaymentStatusClass = getPaymentStatusCssClass;
  paymentMethods = Object.values(PaymentMethod);
  paymentStatuses = Object.values(PaymentStatus);

  getPaymentMethodText = getPaymentMethodText;

  // Thêm các biến cho OrderType
  orderTypes = Object.values(OrderType);
  getOrderTypeText = getOrderTypeText;

  // State cho modal cập nhật trạng thái
  showStatusModal = signal(false);
  orderToUpdateStatus = signal<OrderSummaryResponse | null>(null);
  newStatusControl = new FormControl<OrderStatus | null>(null, Validators.required); // FormControl riêng cho status mới
  statusUpdateLoading = signal(false);
  statusUpdateError = signal<string | null>(null);

  // Các trạng thái Farmer có thể chuyển đến (ví dụ)
  farmerAllowedStatuses = [
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPING,
    OrderStatus.DELIVERED,
    // OrderStatus.CANCELLED // Hủy có thể cần API riêng hoặc logic phức tạp hơn
  ];

  ngOnInit(): void {
    this.loadMyOrders();

    // Lắng nghe thay đổi filter để load lại
    this.filterForm.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage.set(0);
      this.loadMyOrders();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadMyOrders(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const formValue = this.filterForm.value;
    const params: FarmerOrderSearchParams = { // Sử dụng interface đã định nghĩa
      page: this.currentPage(),
      size: this.pageSize(),
      sort: this.sort(),
      keyword: formValue.keyword?.trim() || undefined, // undefined nếu rỗng để HttpParams bỏ qua
      status: formValue.status || undefined,          // undefined nếu rỗng
      paymentMethod: formValue.paymentMethod || undefined, // undefined nếu rỗng
      paymentStatus: formValue.paymentStatus || undefined,
      orderType: formValue.orderType || undefined
    };


    // Xóa các thuộc tính undefined để không gửi lên API nếu không cần thiết
    if (!params.keyword) delete params.keyword;
    if (!params.status) delete params.status;
    if (!params.paymentMethod) delete params.paymentMethod;
    if (!params.paymentStatus) delete params.paymentStatus;
    if (!params.orderType) delete params.orderType;



    this.orderService.getMyOrdersAsFarmer(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.ordersPage.set(res.data);
          } else {
            this.ordersPage.set(null);
            if(res.status !== 404 && !res.success) this.errorMessage.set(res.message || 'Không tải được danh sách đơn hàng.');
          }
          this.isLoading.set(false);
        },
        error: (err) => this.handleError(err, 'Lỗi khi tải danh sách đơn hàng.')
      });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadMyOrders();
  }

  // Xem chi tiết đơn hàng
  viewOrderDetails(orderId: number): void {
    this.router.navigate(['/farmer/orders', orderId]); // Điều hướng đến route chi tiết của Farmer
  }

  // Mở modal cập nhật trạng thái
  openUpdateStatusModal(order: OrderSummaryResponse): void {
    // Chỉ cho phép cập nhật nếu trạng thái hiện tại không phải là trạng thái cuối cùng
    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED || order.status === OrderStatus.RETURNED) {
      this.toastr.info(`Đơn hàng #${order.orderCode} đã ở trạng thái cuối cùng.`);
      return;
    }
    this.orderToUpdateStatus.set(order);
    this.newStatusControl.reset(order.status); // Đặt giá trị ban đầu là trạng thái hiện tại
    this.statusUpdateError.set(null); // Xóa lỗi cũ
    this.showStatusModal.set(true);
  }

  // Đóng modal
  closeStatusModal(): void {
    this.showStatusModal.set(false);
    this.orderToUpdateStatus.set(null);
  }

  // Lưu trạng thái mới
  saveNewStatus(): void {
    if (this.newStatusControl.invalid || !this.orderToUpdateStatus()) {
      return;
    }

    const order = this.orderToUpdateStatus()!;
    const newStatus = this.newStatusControl.value!;

    // Kiểm tra xem có thực sự thay đổi trạng thái không
    if (order.status === newStatus) {
      this.toastr.info('Trạng thái không thay đổi.');
      this.closeStatusModal();
      return;
    }

    this.statusUpdateLoading.set(true);
    this.statusUpdateError.set(null);

    const request: OrderStatusUpdateRequest = { status: newStatus };

    this.orderService.updateFarmerOrderStatus(order.id, request) // Gọi API của Farmer
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.statusUpdateLoading.set(false))
      )
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.toastr.success(`Đã cập nhật trạng thái đơn hàng #${order.orderCode} thành ${this.getOrderStatusText(newStatus)}`);
            this.closeStatusModal();
            this.loadMyOrders(); // Load lại danh sách
          } else {
            this.statusUpdateError.set(res.message || 'Lỗi cập nhật trạng thái.');
            this.toastr.error(res.message || 'Lỗi cập nhật trạng thái.');
          }
        },
        error: (err) => {
          const message = err?.message || 'Lỗi khi cập nhật trạng thái.';
          this.statusUpdateError.set(message);
          this.toastr.error(message);
          console.error(err);
        }
      });
  }


  // Helper xử lý lỗi chung
  private handleError(err: any, defaultMessage: string): void {
    const message = err?.message || defaultMessage;
    this.errorMessage.set(message);
    // this.toastr.error(message); // Có thể không cần toastr ở đây nếu đã có alert
    this.isLoading.set(false);
    console.error(err);
  }

  trackOrderById(index: number, item: OrderSummaryResponse): number {
    return item.id;
  }

}
