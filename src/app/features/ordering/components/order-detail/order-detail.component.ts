import { Component, OnInit, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { OrderResponse } from '../../dto/response/OrderResponse';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { AuthService } from '../../../../core/services/auth.service';
import { OrderStatus, getOrderStatusText, getOrderStatusCssClass } from '../../domain/order-status.enum';
import { PaymentStatus, getPaymentStatusText, getPaymentStatusCssClass } from '../../domain/payment-status.enum';
import { PaymentMethod, getPaymentMethodText } from '../../domain/payment-method.enum';
import { ToastrService } from 'ngx-toastr'; // Import ToastrService
import {Observable, of, shareReplay, Subject} from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe'; // Import Pipe
import { OrderStatusUpdateRequest } from '../../dto/request/OrderStatusUpdateRequest'; // Import DTO update status
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms'; // Import Forms
import { ModalComponent } from '../../../../shared/components/modal/modal.component'; // Import Modal
import { QRCodeComponent } from 'angularx-qrcode';
import { getInvoiceStatusText } from '../../domain/invoice-status.enum';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LoadingSpinnerComponent,
    AlertComponent,
    DatePipe,
    DecimalPipe,
    FormatBigDecimalPipe, // Thêm Pipe
    ReactiveFormsModule, // Thêm Forms
    ModalComponent, // Thêm Modal
    QRCodeComponent
  ],
  templateUrl: './order-detail.component.html',
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();
  private adminOrderingService = inject(AdminOrderingService);
  private locationService = inject(LocationService);

  order = signal<OrderResponse | null>(null);
  isLoading = signal(true);
  isActionLoading = signal(false); // Loading cho các hành động (hủy, cập nhật status)
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);


  isDownloadingInvoice = signal(false);

  bankTransferInfo = signal<BankTransferInfoResponse | null>(null);
  isLoadingBankInfo = signal(false);

  // ****** THÊM CÁC SIGNALS CHO ZOOM QR ******
  isQrCodeZoomed = signal(false);
  zoomedQrCodeUrl = signal<string | null>(null);
  // ****************************************


  // ****** THÊM CACHE CHO TÊN ĐỊA DANH ******
  private locationNameCache = new Map<string, Observable<string | null>>();
  // *****************************************

  // Xác định vai trò và quyền
  currentUser = this.authService.currentUser;
  isAdmin = this.authService.hasRoleSignal('ROLE_ADMIN');
  isFarmer = this.authService.hasRoleSignal('ROLE_FARMER');
  isBuyer = computed(() => {
    const currentUserId = this.currentUser()?.id;
    const orderBuyerId = this.order()?.buyer?.id;
    return !!currentUserId && !!orderBuyerId && currentUserId === orderBuyerId;
  });
  isOrderFarmer = computed(() => { // Kiểm tra xem user hiện tại có phải là farmer của đơn hàng này không
    const currentUserId = this.currentUser()?.id;
    const orderFarmerId = this.order()?.farmer?.farmerId;
    return this.isFarmer() && !!currentUserId && !!orderFarmerId && currentUserId === orderFarmerId;
  });

  // Trạng thái có thể hủy bởi Buyer
  canBuyerCancel = computed(() => {
    const status = this.order()?.status;
    return this.isBuyer() && (status === OrderStatus.PENDING || status === OrderStatus.CONFIRMED);
  });

  // Trạng thái có thể hủy bởi Admin
  canAdminCancel = computed(() => {
    const status = this.order()?.status;
    // Admin có thể hủy nhiều trạng thái hơn? (Tùy logic)
    return this.isAdmin() && status !== OrderStatus.DELIVERED && status !== OrderStatus.CANCELLED && status !== OrderStatus.RETURNED;
  });

  // Trạng thái có thể cập nhật bởi Farmer/Admin
  canUpdateStatus = computed(() => {
    const status = this.order()?.status;
    return (this.isAdmin() || this.isOrderFarmer()) && status !== OrderStatus.DELIVERED && status !== OrderStatus.CANCELLED && status !== OrderStatus.RETURNED;
  });


  // State cho modal cập nhật trạng thái (nếu dùng)
  showStatusModal = signal(false);
  newStatusControl = new FormControl<OrderStatus | null>(null, Validators.required);
  statusUpdateError = signal<string | null>(null);
  // Các trạng thái có thể chuyển đến (tùy thuộc vai trò và trạng thái hiện tại)
  availableNextStatuses = signal<OrderStatus[]>([]);

  // Helpers để dùng trong template
  PaymentMethodEnum = PaymentMethod; // Expose enum cho template
  PaymentStatusEnum = PaymentStatus;
  OrderStatusEnum = OrderStatus;
  InvoiceStatusEnum = InvoiceStatus;
  getStatusText = getOrderStatusText;
  getStatusClass = getOrderStatusCssClass;
  getPaymentStatusText = getPaymentStatusText;
  getPaymentStatusClass = getPaymentStatusCssClass;
  getPaymentMethodText = getPaymentMethodText;
  getInvoiceStatusText = getInvoiceStatusText;


  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const id = params.get('id');
        const code = params.get('code'); // Nếu có route theo code
        if (id) {
          this.loadOrderById(+id);
        } else if (code) {
          this.loadOrderByCode(code);
        } else {
          this.handleErrorAndRedirect('Thiếu ID hoặc Mã đơn hàng.');
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrderById(id: number): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null); // Xóa thông báo cũ
    this.bankTransferInfo.set(null); // Reset thông tin bank transfer cũ
    // Admin gọi API riêng, user thường gọi API chung (đã có kiểm tra quyền ở service)
    const apiCall = this.isAdmin()
      ? this.orderService.getAdminOrderDetails(id)
      : this.orderService.getMyOrderDetailsById(id);

    apiCall.pipe(takeUntil(this.destroy$), finalize(() => this.isLoading.set(false)))
      .subscribe(this.handleOrderResponse);
  }

  loadOrderByCode(code: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    // API này chỉ dành cho user thường (buyer/farmer)
    this.orderService.getMyOrderDetailsByCode(code)
      .pipe(takeUntil(this.destroy$), finalize(() => this.isLoading.set(false)))
      .subscribe(this.handleOrderResponse);
  }

  // Xử lý response chung
  private handleOrderResponse = {
    next: (response: ApiResponse<OrderResponse>) => {
      if (response.success && response.data) {
        this.order.set(response.data);
        // Nếu là chuyển khoản và đang chờ thanh toán, thì gọi lấy thông tin chuyển khoản
        if (response.data.paymentMethod === PaymentMethod.BANK_TRANSFER &&
          (response.data.paymentStatus === PaymentStatus.PENDING || response.data.paymentStatus === PaymentStatus.AWAITING_PAYMENT_TERM)) {
          this.loadBankTransferDetails(response.data.id);
        }

      } else {
        this.order.set(null);
        this.handleErrorAndRedirect(response.message || 'Không tìm thấy đơn hàng.');
      }
    },
    error: (err: ApiResponse<null> | any) => {
      this.order.set(null);
      this.handleErrorAndRedirect(err.message || 'Lỗi khi tải chi tiết đơn hàng.');
      // Không redirect ngay nếu lỗi 403 để user thấy thông báo lỗi
      // if (err.status === 404) this.router.navigate(['/not-found']);
    }
  };

  loadBankTransferDetails(orderId: number): void {
    this.isLoadingBankInfo.set(true);
    this.orderService.getBankTransferInfo(orderId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingBankInfo.set(false))
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.bankTransferInfo.set(res.data);
          } else {
            this.toastr.error(res.message || 'Không tải được thông tin chuyển khoản.');
            this.bankTransferInfo.set(null); // Đặt là null nếu lỗi
          }
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Lỗi tải thông tin chuyển khoản.');
          this.bankTransferInfo.set(null);
        }
      });
  }

  async copyToClipboard(text: string | null | undefined) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.toastr.success(`Đã sao chép: ${text}`);
    } catch (err) {
      this.toastr.error('Không thể sao chép vào clipboard.');
      console.error('Failed to copy: ', err);
    }
  }

  // Hủy đơn hàng
  cancelOrder(): void {
    const orderToCancel = this.order();
    if (!orderToCancel || !(this.canBuyerCancel() || this.canAdminCancel())) return;

    if (confirm(`Bạn có chắc chắn muốn hủy đơn hàng #${orderToCancel.orderCode}?`)) {
      this.isActionLoading.set(true);
      this.errorMessage.set(null);
      this.successMessage.set(null);

      // Admin và Buyer có thể dùng API khác nhau nếu cần logic khác ở backend
      const apiCall = this.isAdmin()
        ? this.orderService.cancelOrderByAdmin(orderToCancel.id)
        : this.orderService.cancelMyOrder(orderToCancel.id);

      apiCall.pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isActionLoading.set(false))
      ).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.order.set(response.data); // Cập nhật lại đơn hàng đã hủy
            this.toastr.success(`Đã hủy đơn hàng #${orderToCancel.orderCode}.`);
          } else {
            this.handleError(response, 'Hủy đơn hàng thất bại.');
          }
        },
        error: (err) => this.handleError(err, 'Lỗi khi hủy đơn hàng.')
      });
    }
  }

  // Mở modal cập nhật trạng thái
  openUpdateStatusModal(): void {
    const currentOrder = this.order();
    if (!currentOrder || !this.canUpdateStatus()) return;

    // Xác định các trạng thái tiếp theo hợp lệ
    this.availableNextStatuses.set(this.getAllowedNextStatuses(currentOrder.status));

    this.newStatusControl.reset(currentOrder.status); // Đặt trạng thái hiện tại
    this.statusUpdateError.set(null);
    this.showStatusModal.set(true);
  }

  // Đóng modal
  closeStatusModal(): void {
    this.showStatusModal.set(false);
  }

  // Lưu trạng thái mới
  saveNewStatus(): void {
    if (this.newStatusControl.invalid || !this.order()) return;

    const order = this.order()!;
    const newStatus = this.newStatusControl.value!;

    if (order.status === newStatus) {
      this.toastr.info('Trạng thái không thay đổi.');
      this.closeStatusModal();
      return;
    }

    this.isActionLoading.set(true); // Dùng loading chung hoặc riêng
    this.statusUpdateError.set(null);

    const request: OrderStatusUpdateRequest = { status: newStatus };
    // Admin và Farmer có thể dùng API khác nhau
    const apiCall = this.isAdmin()
      ? this.adminOrderingService.updateAdminOrderStatus(order.id, request) // Cần inject AdminOrderingService
      : this.orderService.updateFarmerOrderStatus(order.id, request); // Gọi API của Farmer

    apiCall.pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isActionLoading.set(false))
    ).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.order.set(res.data); // Cập nhật đơn hàng
          this.toastr.success(`Đã cập nhật trạng thái đơn hàng thành ${this.getStatusText(newStatus)}`);
          this.closeStatusModal();
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

  // Xác định các trạng thái tiếp theo hợp lệ dựa trên trạng thái hiện tại
  private getAllowedNextStatuses(currentStatus: OrderStatus): OrderStatus[] {
    // Logic này nên khớp với logic isValidStatusTransition ở backend
    switch (currentStatus) {
      case OrderStatus.PENDING:
        return [OrderStatus.CONFIRMED, OrderStatus.CANCELLED]; // Admin/Farmer có thể confirm, Admin/Buyer có thể cancel
      case OrderStatus.CONFIRMED:
        return [OrderStatus.PROCESSING, OrderStatus.CANCELLED]; // Farmer/Admin có thể process, Admin/Buyer có thể cancel
      case OrderStatus.PROCESSING:
        return [OrderStatus.SHIPPING]; // Farmer/Admin có thể ship
      case OrderStatus.SHIPPING:
        return [OrderStatus.DELIVERED]; // Farmer/Admin có thể delivered
      default:
        return []; // Không cho chuyển từ các trạng thái cuối
    }
  }

  // ****** THÊM HÀM getLocationName ******
  getLocationName(type: 'province' | 'district' | 'ward', code: string | null | undefined): Observable<string | null> {
    if (!code || code === 'undefined') {
      return of(null);
    }

    const cacheKey = `${type}_${code}`;
    if (this.locationNameCache.has(cacheKey)) {
      return this.locationNameCache.get(cacheKey)!;
    }

    let name$: Observable<string | null>;
    switch (type) {
      case 'province':
        name$ = this.locationService.findProvinceName(code);
        break;
      case 'district':
        name$ = this.locationService.findDistrictName(code);
        break;
      case 'ward':
        name$ = this.locationService.findWardName(code);
        break;
      default:
        name$ = of(null);
    }
    const cachedName$ = name$.pipe(shareReplay(1));
    this.locationNameCache.set(cacheKey, cachedName$);
    return cachedName$;
  }
  // ************************************

  confirmPaymentByAdmin(orderId: number, methodSelectedByAdmin: string, transactionRef?: string, notes?: string): void {
    if (!this.isAdmin() || !this.order()) return;

    const order = this.order()!;
    const paymentMethodConfirmed = methodSelectedByAdmin as PaymentMethod;

    // Thông báo xác nhận
    let confirmMessage = `Bạn có chắc chắn muốn xác nhận đã nhận thanh toán cho đơn hàng #${order.orderCode} bằng phương thức ${this.getPaymentMethodText(paymentMethodConfirmed)}?`;
    if (order.paymentMethod === PaymentMethod.INVOICE) {
      confirmMessage = `Xác nhận khách hàng đã thanh toán công nợ cho đơn hàng #${order.orderCode} bằng ${this.getPaymentMethodText(paymentMethodConfirmed)}?`;
    }

    if (confirm(confirmMessage)) {
      this.isActionLoading.set(true);
      this.adminOrderingService.confirmOrderPayment(orderId, paymentMethodConfirmed, { notes, transactionReference: transactionRef })
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => this.isActionLoading.set(false))
        )
        .subscribe({
          next: (res) => {
            if (res.success && res.data) {
              this.order.set(res.data); // Cập nhật lại order với thông tin mới
              this.toastr.success("Đã xác nhận thanh toán cho đơn hàng!");
              // Nếu có thông tin bank transfer, có thể cần load lại hoặc ẩn đi
              if (res.data.paymentStatus === PaymentStatus.PAID) {
                this.bankTransferInfo.set(null);
              }
            } else {
              this.toastr.error(res.message || "Lỗi xác nhận thanh toán.");
            }
          },
          error: (err) => {
            this.toastr.error(err.error?.message || "Lỗi kết nối khi xác nhận thanh toán.");
          }
        });
    }
  }

  // ****** THÊM CÁC HÀM XỬ LÝ ZOOM ******
  openQrCodeZoomModal(imageUrl: string | null): void {
    if (imageUrl) {
      this.zoomedQrCodeUrl.set(imageUrl);
      this.isQrCodeZoomed.set(true);
    }
  }

  closeQrCodeZoomModal(): void {
    this.isQrCodeZoomed.set(false);
    // Không cần reset zoomedQrCodeUrl ngay, nó sẽ tự mất khi modal đóng
    // Hoặc this.zoomedQrCodeUrl.set(null); nếu muốn
  }
  // *************************************


  // Helper xử lý lỗi và điều hướng
  private handleErrorAndRedirect(message: string): void {
    this.errorMessage.set(message);
    this.toastr.error(message);
    this.isLoading.set(false);
    // Có thể điều hướng về trang trước hoặc trang lịch sử đơn hàng
    // this.router.navigate(['/user/orders']);
  }
  // Helper xử lý lỗi chung
  private handleError(err: any, defaultMessage: string): void {
    const message = err?.message || defaultMessage;
    this.errorMessage.set(message);
    this.toastr.error(message);
    this.isLoading.set(false);
    this.isActionLoading.set(false); // Tắt cả loading action
    console.error(err);
  }

  trackItemById(index: number, item: any): number { // TrackBy chung
    return item.id;
  }

  downloadInvoice(): void {
    if (!this.order()) return;

    const currentOrder = this.order()!;
    const orderCode = currentOrder.orderCode;
    const invoiceIdToDownload = currentOrder.invoiceInfo?.invoiceId; // Lấy invoiceId từ invoiceInfo
    const orderIdToDownload = currentOrder.id;

    this.isDownloadingInvoice.set(true);
    let downloadObservable: Observable<Blob>;

    if (invoiceIdToDownload) {
      console.log(`Downloading invoice using invoiceId: ${invoiceIdToDownload}`);
      downloadObservable = this.orderService.downloadInvoiceByInvoiceId(invoiceIdToDownload);
    } else {
      // Fallback nếu không có invoiceId (hoặc nếu bạn muốn luôn dùng orderId cho API này)
      console.log(`Downloading invoice using orderId: ${orderIdToDownload}`);
      downloadObservable = this.orderService.downloadInvoiceByOrderId(orderIdToDownload);
    }

    downloadObservable
      .pipe(finalize(() => this.isDownloadingInvoice.set(false)))
      .subscribe({
        next: (blob) => {
          if (blob.size > 0) {
            // Tạo tên file dựa trên số hóa đơn nếu có, nếu không thì dùng mã đơn hàng
            const fileNameInvoiceNumber = currentOrder.invoiceInfo?.invoiceNumber;
            const finalFileName = fileNameInvoiceNumber
              ? `hoa-don-${fileNameInvoiceNumber}.pdf`
              : `hoa-don-donhang-${orderCode}.pdf`;
            saveAs(blob, finalFileName);
            this.toastr.success('Đã tải xuống hóa đơn.');
          } else {
            this.toastr.error('Không thể tạo hóa đơn hoặc hóa đơn trống.');
          }
        },
        error: (err) => {
          console.error("Error downloading invoice:", err);
          let errorMessage = 'Lỗi khi tải hóa đơn.';
          if (err.status === 404) {
            errorMessage = 'Không tìm thấy hóa đơn cho đơn hàng này.';
          } else if (err.error instanceof Blob && err.error.type === "application/json") {
            // Cố gắng đọc lỗi JSON từ Blob
            const reader = new FileReader();
            reader.onload = (e: any) => {
              try {
                const errorResponse = JSON.parse(e.target.result);
                this.toastr.error(errorResponse.message || errorMessage);
              } catch (parseError) {
                this.toastr.error(errorMessage);
              }
            };
            reader.readAsText(err.error);
            return; // Tránh toastr mặc định bên dưới
          } else if (err.error?.message) {
            errorMessage = err.error.message;
          } else if (err.message) {
            errorMessage = err.message;
          }
          this.toastr.error(errorMessage);
        }
      });
  }

  promptAndConfirmPayment(orderId: number, paymentMethodConfirmedStr: string): void {
    const paymentMethodConfirmed = paymentMethodConfirmedStr as PaymentMethod;
    const transactionRef = prompt(`Nhập mã giao dịch/tham chiếu (nếu có) cho phương thức ${this.getPaymentMethodText(paymentMethodConfirmed)}:`);
    const notes = prompt(`Ghi chú thêm của Admin (tùy chọn):`);

    // Gọi hàm confirmPaymentByAdmin đã có, nhưng truyền paymentMethodConfirmed từ lựa chọn của Admin
    this.confirmPaymentByAdmin(orderId, paymentMethodConfirmed, transactionRef ?? undefined, notes ?? undefined);
  }

  isInvoiceOverdue(dueDateString: string | null | undefined, status: InvoiceStatus | string): boolean {
    if (!dueDateString || status === InvoiceStatus.PAID || status === InvoiceStatus.VOID) {
      return false;
    }
    // Chuyển đổi dueDateString (ví dụ: "2025-05-30") thành đối tượng Date
    const dueDate = new Date(dueDateString);
    const today = new Date();
    // Set giờ, phút, giây, ms về 0 để so sánh chỉ ngày
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    return dueDate < today && status !== InvoiceStatus.PAID && status !== InvoiceStatus.VOID;
  }

  protected readonly HTMLInputElement = HTMLInputElement;
}

// Cần inject AdminOrderingService nếu chưa có
import { AdminOrderingService } from '../../../admin-dashboard/services/admin-ordering.service';
import {saveAs} from 'file-saver';
import {LocationService} from '../../../../core/services/location.service';
import {environment} from '../../../../../environments/environment';
import {BankTransferInfoResponse} from '../../dto/response/BankTransferInfoResponse';
import {InvoiceStatus} from '../../domain/invoice-status.enum';
