import { Component, OnInit, inject, signal, WritableSignal, effect } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Page } from '../../../../core/models/page.model'; // Tạo interface Page nếu cần
import { OrderSummaryResponse } from '../../dto/response/OrderSummaryResponse';
import {FarmerOrderSearchParams, OrderService} from '../../services/order.service';
import { AuthService } from '../../../../core/services/auth.service';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { OrderStatus, getOrderStatusText, getOrderStatusCssClass } from '../../domain/order-status.enum'; // Import Enum và helpers
import { PaymentStatus, getPaymentStatusText, getPaymentStatusCssClass } from '../../domain/payment-status.enum';
import {Observable} from 'rxjs';
import {PagedApiResponse} from '../../../../core/models/api-response.model';
import {FormatBigDecimalPipe} from '../../../../shared/pipes/format-big-decimal.pipe'; // Import Enum và helpers


// Interface cho Page (tương tự PageData nhưng đơn giản hơn)
interface PageData<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number; // Current page number (0-based)
  size: number;
}


@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule, RouterLink, PaginatorComponent, LoadingSpinnerComponent, AlertComponent, DatePipe, DecimalPipe, FormatBigDecimalPipe],
  templateUrl: './order-history.component.html',
})
export class OrderHistoryComponent implements OnInit {
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private router = inject(Router); // Inject Router

  // Sử dụng signal để lưu trữ dữ liệu phân trang
  orderPage: WritableSignal<PageData<OrderSummaryResponse> | null> = signal(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  // Signal cho các tham số phân trang hiện tại
  currentPage = signal(0);
  pageSize = signal(10); // Số đơn hàng mỗi trang
  sort = signal('createdAt,desc'); // Sắp xếp mặc định

  // Xác định vai trò của người dùng
  isFarmer = this.authService.hasRoleSignal('ROLE_FARMER');

  constructor() {
    // Effect để tự động load lại đơn hàng khi trang hoặc sắp xếp thay đổi
    effect(() => {
      this.loadOrders(this.currentPage(), this.pageSize(), this.sort());
    });
  }

  ngOnInit(): void {
    // Không cần gọi loadOrders ở đây vì effect đã xử lý
  }

  loadOrders(page: number, size: number, sort: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    let apiCall: Observable<PagedApiResponse<OrderSummaryResponse>>;

    if (this.isFarmer()) {
      // TẠO OBJECT PARAMS CHO FARMER
      const farmerParams: FarmerOrderSearchParams = {
        page: page,
        size: size,
        sort: sort
        // keyword và status sẽ là undefined, nên không được gửi đi (đúng như mong đợi cho trang này)
      };
      apiCall = this.orderService.getMyOrdersAsFarmer(farmerParams);
    } else {
      // Mặc định là Buyer (Consumer hoặc Business Buyer)
      apiCall = this.orderService.getMyOrdersAsBuyer(page, size, sort);
    }

    apiCall.subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.orderPage.set(response.data);
        } else {
          this.orderPage.set(null);
          this.errorMessage.set(response.message || 'Không tải được lịch sử đơn hàng.');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.orderPage.set(null);
        this.errorMessage.set(err.message || 'Đã xảy ra lỗi.');
        this.isLoading.set(false);
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page); // Trigger effect để load lại
  }

  // Helper functions để dùng trong template
  getStatusText = getOrderStatusText;
  getStatusClass = getOrderStatusCssClass;
  getPaymentStatusText = getPaymentStatusText;
  getPaymentStatusClass = getPaymentStatusCssClass;

  // Điều hướng đến chi tiết đơn hàng
  viewDetails(orderId: number): void {
    const basePath = this.isFarmer() ? '/farmer/orders' : '/user/orders'; // Hoặc chỉ /orders nếu dùng layout public
    this.router.navigate([basePath, orderId]);
    // Hoặc dùng order code: this.router.navigate([basePath, 'code', orderCode]);
  }
}
