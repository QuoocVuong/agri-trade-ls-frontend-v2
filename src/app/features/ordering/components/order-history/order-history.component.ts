import {Component, OnInit, inject, signal, WritableSignal, effect, OnDestroy} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { OrderSummaryResponse } from '../../dto/response/OrderSummaryResponse';
import {BuyerOrderSearchParams, OrderService} from '../../services/order.service';
import { AuthService } from '../../../../core/services/auth.service';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { OrderStatus, getOrderStatusText, getOrderStatusCssClass } from '../../domain/order-status.enum';
import { PaymentStatus, getPaymentStatusText, getPaymentStatusCssClass } from '../../domain/payment-status.enum';
import {Observable, Subject} from 'rxjs';
import {PagedApiResponse} from '../../../../core/models/api-response.model';
import {FormatBigDecimalPipe} from '../../../../shared/pipes/format-big-decimal.pipe';
import {debounceTime, distinctUntilChanged, takeUntil} from 'rxjs/operators';
import {FormBuilder, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {getPaymentMethodText, PaymentMethod} from '../../domain/payment-method.enum';
import {getOrderTypeText, OrderType} from '../../domain/order-type.enum';


// Interface cho Page
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
  imports: [CommonModule, RouterLink, PaginatorComponent, LoadingSpinnerComponent, AlertComponent, DatePipe, DecimalPipe, FormatBigDecimalPipe, FormsModule, ReactiveFormsModule],
  templateUrl: './order-history.component.html',
})
export class OrderHistoryComponent implements OnInit, OnDestroy  {
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private router = inject(Router); // Inject Router
  private fb = inject(FormBuilder);

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

  // Signal cho bộ lọc và tìm kiếm
  selectedStatus = signal<OrderStatus | null>(null);
  searchKeyword = signal<string>('');
  private searchInput$ = new Subject<string>(); // Subject để xử lý debounce
  private destroy$ = new Subject<void>(); // Subject để unsubscribe

  OrderStatusEnum = OrderStatus;
  objectKeys = Object.keys as <T extends object>(obj: T) => Array<keyof T>;

  selectedPaymentMethod = signal<PaymentMethod | null>(null);
  PaymentMethodEnum = PaymentMethod; // Expose cho template

  selectedPaymentStatus = signal<PaymentStatus | null>(null);
  PaymentStatusEnum = PaymentStatus;

  selectedOrderType =signal<OrderType | null>(null);
  OrderTypeEnum = OrderType;

  // Thêm các biến cho OrderType
  getOrderTypeText = getOrderTypeText;

  constructor() {
    // Effect để tự động load lại đơn hàng khi trang hoặc sắp xếp thay đổi
    effect(() => {
      this.loadOrders(
        this.currentPage(),
        this.pageSize(),
        this.sort(),
        this.selectedStatus(),
        this.selectedPaymentMethod(),
        this.selectedPaymentStatus(),
        this.selectedOrderType(),
        this.searchKeyword()

      );
    });
  }

  ngOnInit(): void {
    this.searchInput$.pipe(
      debounceTime(500), // Chờ 500ms sau khi người dùng ngừng gõ
      distinctUntilChanged(), // Chỉ kích hoạt nếu giá trị thay đổi
      takeUntil(this.destroy$) // Unsubscribe khi component bị hủy
    ).subscribe(keyword => {
      this.searchKeyword.set(keyword.trim());
      this.currentPage.set(0); // Reset về trang đầu khi tìm kiếm
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  loadOrders(
    page: number,
    size: number,
    sort: string,
    status: OrderStatus | null = null,
    paymentMethod: PaymentMethod | null = null,
    paymentStatus: PaymentStatus | null = null,
    orderTypes: OrderType | null = null,
  keyword: string = ''

  ): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    let apiCall: Observable<PagedApiResponse<OrderSummaryResponse>>;


      const buyerParams: BuyerOrderSearchParams = {
        page: page,
        size: size,
        sort: sort,
        status: status ?? undefined,
        paymentMethod: paymentMethod ?? undefined,
        paymentStatus: paymentStatus ?? undefined,
        orderType: orderTypes ?? undefined,
        keyword: keyword || undefined
      };
      // Mặc định là Buyer (Consumer hoặc Business Buyer)
      apiCall = this.orderService.getMyOrdersAsBuyer(buyerParams);


    apiCall.pipe(takeUntil(this.destroy$)).subscribe({ // Thêm takeUntil
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
        this.errorMessage.set(err.error?.message || err.message || 'Đã xảy ra lỗi khi tải đơn hàng.');
        this.isLoading.set(false);
      }
    });
  }

  filterByPaymentMethod(method: PaymentMethod | null): void {
    this.selectedPaymentMethod.set(method);
    this.currentPage.set(0); // Reset về trang đầu
    // Effect sẽ tự động gọi loadOrders
  }

  filterByPaymentStatus(status: PaymentStatus | null): void { // <<<< HÀM MỚI
    this.selectedPaymentStatus.set(status);
    this.currentPage.set(0);
  }

  onPageChange(page: number): void {
    this.currentPage.set(page); // Trigger effect để load lại
  }
  filterByStatus(status: OrderStatus | null): void {
    this.selectedStatus.set(status);
    this.currentPage.set(0);
  }
  filterOrderType(status: OrderType | null): void {
    this.selectedOrderType.set(status);
    this.currentPage.set(0);
  }

  // Hàm xử lý khi người dùng nhập vào ô tìm kiếm
  onSearchInput(event: Event): void {
    const keyword = (event.target as HTMLInputElement).value;
    this.searchInput$.next(keyword); // Đẩy giá trị vào Subject để debounce
  }

  // Hàm để xóa nhanh từ khóa tìm kiếm
  clearSearch(): void {
    this.searchInput$.next(''); // Đặt lại Subject
    // this.searchKeyword.set(''); // Có thể đặt trực tiếp nếu không muốn debounce khi xóa
    // this.currentPage.set(0);
  }

  // Helper functions để dùng trong template
  getStatusText = getOrderStatusText;
  getStatusClass = getOrderStatusCssClass;
  getPaymentStatusText = getPaymentStatusText;
  getPaymentStatusClass = getPaymentStatusCssClass;

  getPaymentMethodText = getPaymentMethodText;

  // Điều hướng đến chi tiết đơn hàng
  viewDetails(orderId: number): void {
    // Trang lịch sử đơn hàng của user (buyer) sẽ điều hướng đến chi tiết đơn hàng của user
    this.router.navigate(['/user/orders', orderId]);
  }


  trackOrderById(index: number, item: OrderSummaryResponse): number {
    return item.id;
  }


}
