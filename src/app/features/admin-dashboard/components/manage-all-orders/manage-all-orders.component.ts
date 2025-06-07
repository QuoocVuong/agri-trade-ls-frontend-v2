import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Page } from '../../../../core/models/page.model';
import { OrderSummaryResponse } from '../../../ordering/dto/response/OrderSummaryResponse';
import { AdminOrderingService } from '../../services/admin-ordering.service';

import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { OrderStatus, getOrderStatusText, getOrderStatusCssClass } from '../../../ordering/domain/order-status.enum'; // Import OrderStatus
import {
  getPaymentStatusText,
  getPaymentStatusCssClass,
  PaymentStatus
} from '../../../ordering/domain/payment-status.enum';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import {FormatBigDecimalPipe} from '../../../../shared/pipes/format-big-decimal.pipe';
import {getPaymentMethodText, PaymentMethod} from '../../../ordering/domain/payment-method.enum';

@Component({
  selector: 'app-manage-all-orders',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LoadingSpinnerComponent, AlertComponent, PaginatorComponent, DatePipe, DecimalPipe, FormatBigDecimalPipe],
  templateUrl: './manage-all-orders.component.html',
})
export class ManageAllOrdersComponent implements OnInit, OnDestroy {
  private adminOrderingService = inject(AdminOrderingService);
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  ordersPage = signal<Page<OrderSummaryResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  paymentMethods = Object.values(PaymentMethod);
  paymentStatuses = Object.values(PaymentStatus);

  getPaymentMethodText = getPaymentMethodText;

  // Filter form
  filterForm = this.fb.group({
    keyword: [''], // Tìm theo mã đơn hàng, tên người mua/bán?
    status: [''], // Lọc theo OrderStatus
    paymentMethod: [''],
    paymentStatus: [''],
    buyerId: [''],
    farmerId: [''],

  });

  // Phân trang & Sắp xếp
  currentPage = signal(0);
  pageSize = signal(15);
  sort = signal('createdAt,desc');

  // Lấy danh sách OrderStatus để hiển thị trong dropdown filter
  orderStatuses = Object.values(OrderStatus);
  getStatusText = getOrderStatusText;
  getStatusClass = getOrderStatusCssClass;
  getPaymentStatusText = getPaymentStatusText; // Import và dùng nếu cần hiển thị PaymentStatus
  getPaymentStatusClass = getPaymentStatusCssClass;

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

  // Hàm xử lý khi cần cập nhật trạng thái (ví dụ: mở modal hoặc gọi API trực tiếp)
  // Cần tạo component/modal riêng cho việc cập nhật trạng thái nếu phức tạp
  updateStatus(orderId: number): void {
    // TODO: Implement logic mở modal hoặc form để chọn trạng thái mới và gọi API updateAdminOrderStatus
    this.toastr.info(`Chức năng cập nhật trạng thái cho đơn hàng ${orderId} chưa được triển khai.`);
  }

  // Hàm xử lý khi cần hủy đơn (ví dụ)
  cancelOrder(order: OrderSummaryResponse): void {
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DELIVERED || order.status === OrderStatus.RETURNED) {
      this.toastr.warning(`Không thể hủy đơn hàng ở trạng thái ${this.getStatusText(order.status)}.`);
      return;
    }
    if (confirm(`Bạn có chắc chắn muốn HỦY đơn hàng #${order.orderCode}?`)) {
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


}
