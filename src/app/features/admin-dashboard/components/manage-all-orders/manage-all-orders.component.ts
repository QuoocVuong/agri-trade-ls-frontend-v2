import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import {ReactiveFormsModule, FormBuilder, Validators, FormControl} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Page } from '../../../../core/models/page.model';
import { OrderSummaryResponse } from '../../../ordering/dto/response/OrderSummaryResponse';
import { AdminOrderingService } from '../../services/admin-ordering.service';

import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { OrderStatus, getOrderStatusText, getOrderStatusCssClass } from '../../../ordering/domain/order-status.enum';
import {
  getPaymentStatusText,
  getPaymentStatusCssClass,
  PaymentStatus
} from '../../../ordering/domain/payment-status.enum';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import {debounceTime, distinctUntilChanged, finalize, takeUntil} from 'rxjs/operators';
import {FormatBigDecimalPipe} from '../../../../shared/pipes/format-big-decimal.pipe';
import {getPaymentMethodText, PaymentMethod} from '../../../ordering/domain/payment-method.enum';
import {getOrderTypeText, OrderType} from '../../../ordering/domain/order-type.enum';
import {ConfirmationService} from '../../../../shared/services/confirmation.service';
import {OrderStatusUpdateRequest} from '../../../ordering/dto/request/OrderStatusUpdateRequest';
import {ModalComponent} from '../../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-manage-all-orders',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LoadingSpinnerComponent, AlertComponent, PaginatorComponent, DatePipe, DecimalPipe, FormatBigDecimalPipe, ModalComponent],
  templateUrl: './manage-all-orders.component.html',
})
export class ManageAllOrdersComponent implements OnInit, OnDestroy {
  private adminOrderingService = inject(AdminOrderingService);
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();
  private confirmationService = inject(ConfirmationService);


  ordersPage = signal<Page<OrderSummaryResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  paymentMethods = Object.values(PaymentMethod);
  paymentStatuses = Object.values(PaymentStatus);

  getPaymentMethodText = getPaymentMethodText;

  orderTypes = Object.values(OrderType);
  getOrderTypeText = getOrderTypeText;

  isExporting = signal(false);


  // Filter form
  filterForm = this.fb.group({
    keyword: [''], // Tìm theo mã đơn hàng, tên người mua/bán?
    status: [''], // Lọc theo OrderStatus
    paymentMethod: [''],
    paymentStatus: [''],
    buyerId: [''],
    farmerId: [''],
    orderType: ['']

  });

  // Phân trang & Sắp xếp
  currentPage = signal(0);
  pageSize = signal(15);
  sort = signal('createdAt,desc');

  // Lấy danh sách OrderStatus để hiển thị trong dropdown filter
  orderStatuses = Object.values(OrderStatus);
  getStatusText = getOrderStatusText;
  getStatusClass = getOrderStatusCssClass;
  getPaymentStatusText = getPaymentStatusText;
  getPaymentStatusClass = getPaymentStatusCssClass;



  showStatusModal = signal(false);
  orderToUpdateStatus = signal<OrderSummaryResponse | null>(null);
  newStatusControl = new FormControl<OrderStatus | null>(null, Validators.required);
  statusUpdateLoading = signal(false);
  statusUpdateError = signal<string | null>(null);

  // Các trạng thái Admin có thể chuyển đến (ví dụ)
  adminAllowedStatuses = [
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPING,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
    OrderStatus.RETURNED,
  ];


  ngOnInit(): void {
    this.loadOrders();

    // Lắng nghe thay đổi filter để load lại
    this.filterForm.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage.set(0);
      this.loadOrders();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrders(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const formValue = this.filterForm.value;
    const params = {
      page: this.currentPage(),
      size: this.pageSize(),
      sort: this.sort(),
      keyword: formValue.keyword || undefined,
      status: formValue.status || undefined,
      paymentMethod: formValue.paymentMethod || undefined,
      paymentStatus: formValue.paymentStatus || undefined,
      orderType: formValue.orderType || undefined,
      buyerId: formValue.buyerId ? +formValue.buyerId : undefined,
      farmerId: formValue.farmerId ? +formValue.farmerId : undefined
    };

    this.adminOrderingService.getAllOrdersForAdmin(params)
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
    this.loadOrders();
  }

  // Xem chi tiết đơn hàng (điều hướng đến trang chi tiết)
  viewOrderDetails(orderId: number): void {
    this.router.navigate(['/admin/orders', orderId]); // Điều hướng đến route chi tiết của Admin
  }

  // Hàm xử lý khi cần cập nhật trạng thái

  openUpdateStatusModal(order: OrderSummaryResponse): void {
    // Không cho phép cập nhật các trạng thái cuối cùng
    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED || order.status === OrderStatus.RETURNED) {
      this.toastr.info(`Đơn hàng #${order.orderCode} đã ở trạng thái cuối cùng, không thể cập nhật.`);
      return;
    }
    this.orderToUpdateStatus.set(order);
    this.newStatusControl.reset(null); // Reset về trạng thái trống
    this.statusUpdateError.set(null);
    this.showStatusModal.set(true);
  }

  closeStatusModal(): void {
    this.showStatusModal.set(false);
    this.orderToUpdateStatus.set(null);
  }

  saveNewStatus(): void {
    if (this.newStatusControl.invalid || !this.orderToUpdateStatus()) {
      return;
    }

    const order = this.orderToUpdateStatus()!;
    const newStatus = this.newStatusControl.value!;

    if (order.status === newStatus) {
      this.toastr.info('Trạng thái không thay đổi.');
      this.closeStatusModal();
      return;
    }

    this.statusUpdateLoading.set(true);
    this.statusUpdateError.set(null);

    const request: OrderStatusUpdateRequest = { status: newStatus };

    this.adminOrderingService.updateAdminOrderStatus(order.id, request)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.statusUpdateLoading.set(false))
      )
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.toastr.success(`Đã cập nhật trạng thái đơn hàng #${order.orderCode}.`);
            this.closeStatusModal();
            this.loadOrders(); // Tải lại danh sách để cập nhật
          } else {
            const message = res.message || 'Lỗi cập nhật trạng thái.';
            this.statusUpdateError.set(message);
            this.toastr.error(message);
          }
        },
        error: (err) => {
          const message = err.error?.message || 'Lỗi hệ thống khi cập nhật trạng thái.';
          this.statusUpdateError.set(message);
          this.toastr.error(message);
        }
      });
  }


// Hàm xử lý khi cần hủy đơn
  cancelOrder(order: OrderSummaryResponse): void {
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DELIVERED || order.status === OrderStatus.RETURNED) {
      this.toastr.warning(`Không thể hủy đơn hàng ở trạng thái ${this.getStatusText(order.status)}.`);
      return;
    }
    this.confirmationService.open({
      title: 'Xác Nhận Hủy Đơn Hàng',
      message: `Bạn có chắc chắn muốn HỦY đơn hàng #${order.orderCode}? Hành động này không thể hoàn tác.`,
      confirmText: 'Xác nhận hủy',
      cancelText: 'Không',
      confirmButtonClass: 'btn-error',
      iconClass: 'fas fa-exclamation-triangle',
      iconColorClass: 'text-error'
    }).subscribe(confirmed => {
      if (confirmed) {
        this.isLoading.set(true); // Dùng loading chung
        this.adminOrderingService.cancelOrderByAdmin(order.id).subscribe({
          next: (res) => {
            if(res.success) {
              this.toastr.success(`Đã hủy đơn hàng #${order.orderCode}.`);
              this.loadOrders(); // Load lại danh sách
            } else {
              this.handleError(res, 'Lỗi khi hủy đơn hàng.');
            }
            this.isLoading.set(false);
          },
          error: (err) => {
            this.handleError(err, 'Lỗi khi hủy đơn hàng.');
            this.isLoading.set(false);
          }
        });
      }
      // Nếu `confirmed` là false, không làm gì cả.
    });

  }

  // Thêm hàm reset bộ lọc
  resetFilters(): void {
    this.filterForm.reset({
      keyword: '',
      status: '',
      paymentMethod: '',
      paymentStatus: '',
      buyerId: '',
      farmerId: ''
    });
    // valueChanges sẽ tự động trigger loadOrders() với giá trị rỗng
  }

  // Helper xử lý lỗi
  private handleError(err: any, defaultMessage: string): void {
    const message = err?.message || defaultMessage;
    this.errorMessage.set(message);
    this.toastr.error(message);
    this.isLoading.set(false);
    console.error(err);
  }

  trackOrderById(index: number, item: OrderSummaryResponse): number {
    return item.id;
  }

  exportToExcel(): void {
    if (this.isExporting()) return;
    this.isExporting.set(true);
    this.toastr.info('Đang chuẩn bị file để xuất...', 'Vui lòng chờ');

    const formValue = this.filterForm.value;
    const params = { // Lấy các tham số lọc hiện tại
      keyword: formValue.keyword || undefined,
      status: formValue.status || undefined,
      paymentMethod: formValue.paymentMethod || undefined,
      paymentStatus: formValue.paymentStatus || undefined,
      buyerId: formValue.buyerId ? +formValue.buyerId : undefined,
      farmerId: formValue.farmerId ? +formValue.farmerId : undefined,
      orderType: formValue.orderType || undefined
    };

    this.adminOrderingService.exportOrders(params) // Gọi API export mới
      .pipe(finalize(() => this.isExporting.set(false)))
      .subscribe({
        next: (blob) => {
          // Tạo link và kích hoạt tải xuống
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `don_hang_${new Date().toISOString().slice(0, 10)}.xlsx`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
          this.toastr.success('Xuất file Excel thành công!');
        },
        error: (err) => {
          this.toastr.error('Có lỗi xảy ra khi xuất file.');
          console.error(err);
        }
      });
  }


}
