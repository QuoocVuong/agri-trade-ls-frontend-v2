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
import { ToastrService } from 'ngx-toastr';
import {Observable, of, shareReplay, Subject} from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';
import { OrderStatusUpdateRequest } from '../../dto/request/OrderStatusUpdateRequest';
import {ReactiveFormsModule, FormControl, Validators, FormBuilder} from '@angular/forms';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { QRCodeComponent } from 'angularx-qrcode';
import { getInvoiceStatusText } from '../../domain/invoice-status.enum';
import { AdminOrderingService } from '../../../admin-dashboard/services/admin-ordering.service';
import {saveAs} from 'file-saver';
import {LocationService} from '../../../../core/services/location.service';

import {BankTransferInfoResponse} from '../../dto/response/BankTransferInfoResponse';
import {InvoiceStatus} from '../../domain/invoice-status.enum';
import {ConfirmationService} from '../../../../shared/services/confirmation.service';

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
    FormatBigDecimalPipe,
    ReactiveFormsModule,
    ModalComponent,
    QRCodeComponent
  ],
  templateUrl: './order-detail.component.html',
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();
  private adminOrderingService = inject(AdminOrderingService);
  private locationService = inject(LocationService);

  private confirmationService = inject(ConfirmationService);



  order = signal<OrderResponse | null>(null);
  isLoading = signal(true);
  isActionLoading = signal(false); // Loading cho các hành động (hủy, cập nhật status)
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);


  isDownloadingInvoice = signal(false);

  bankTransferInfo = signal<BankTransferInfoResponse | null>(null);
  isLoadingBankInfo = signal(false);

  // ******  CÁC SIGNALS CHO ZOOM QR ******
  isQrCodeZoomed = signal(false);
  zoomedQrCodeUrl = signal<string | null>(null);


  // Signals cho modal thông tin chuyển khoản (DÙNG CHUNG cho cả BANK_TRANSFER và INVOICE khi click nút)
  bankTransferInfoModal = signal<BankTransferInfoResponse | null>(null);
  isLoadingBankInfoInModal = signal(false);
  showBankInfoModal = signal(false); // Điều khiển việc hiển thị modal này



  // ******  CACHE CHO TÊN ĐỊA DANH ******
  private locationNameCache = new Map<string, Observable<string | null>>();


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
        const code = params.get('code');
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
    // Admin gọi API riêng, user thường gọi API chung
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

        if (response.data.paymentMethod === PaymentMethod.BANK_TRANSFER &&
          response.data.paymentStatus === PaymentStatus.PENDING &&
          response.data.id != null) {
          this.loadBankTransferDetailsAndSetSignal(response.data.id, this.bankTransferInfo, this.isLoadingBankInfo); // Dùng signal cũ cho hiển thị trực tiếp
        } else {
          this.bankTransferInfo.set(null); // Reset nếu không phải trường hợp cần hiển thị
        }
      } else {
        this.order.set(null);
        this.handleErrorAndRedirect(response.message || 'Không tìm thấy đơn hàng.');
      }
    },
    error: (err: ApiResponse<null> | any) => {
      this.order.set(null);
      this.handleErrorAndRedirect(err.message || 'Lỗi khi tải chi tiết đơn hàng.');

    }
  };


  // Hàm load thông tin chuyển khoản và set vào signal được truyền vào
  private loadBankTransferDetailsAndSetSignal(
    orderId: number,
    targetSignal: ReturnType<typeof signal<BankTransferInfoResponse | null>>,
    loadingSignal: ReturnType<typeof signal<boolean>>
  ): void {
    loadingSignal.set(true);
    targetSignal.set(null); // Xóa thông tin cũ
    this.orderService.getBankTransferInfo(orderId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => loadingSignal.set(false))
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            targetSignal.set(res.data);
          } else {
            this.toastr.error(res.message || 'Không tải được thông tin chuyển khoản.');
          }
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Lỗi tải thông tin chuyển khoản.');
        }
      });
  }

  // Mở modal thông tin chuyển khoản (cho đơn INVOICE hoặc khi click nút)
  openBankTransferInfoModalForInvoice(): void {
    const currentOrder = this.order();
    if (currentOrder && currentOrder.id != null) {
      this.showBankInfoModal.set(true); // Mở modal
      // Load thông tin vào signal DÀNH RIÊNG CHO MODAL
      this.loadBankTransferDetailsAndSetSignal(currentOrder.id, this.bankTransferInfoModal, this.isLoadingBankInfoInModal);
    } else {
      this.toastr.error('Không tìm thấy thông tin đơn hàng để hiển thị hướng dẫn thanh toán.');
    }
  }

  closeBankInfoModal(): void {
    this.showBankInfoModal.set(false);
  }


  //  NÚT "TÔI ĐÃ THANH TOÁN" (Cho đơn hàng INVOICE)
  showNotifyPaymentModal = signal(false);
  paymentNotificationForm = this.fb.group({ // Thêm FormBuilder vào injects nếu chưa có
    referenceCode: [''],
    notes: ['']
  });

  openNotifyPaymentModal(): void {
    this.paymentNotificationForm.reset();
    this.showNotifyPaymentModal.set(true);
  }

  closeNotifyPaymentModal(): void {
    this.showNotifyPaymentModal.set(false);
  }

  submitPaymentNotification(): void {
    if (!this.order() || !this.order()?.id) return;

    const orderId = this.order()!.id;
    const payload = {
      referenceCode: this.paymentNotificationForm.value.referenceCode || null,
      notes: this.paymentNotificationForm.value.notes || null
    };

    this.isActionLoading.set(true);
    this.orderService.notifyPaymentMade(orderId, payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isActionLoading.set(false))
      )
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.toastr.success('Đã gửi thông báo thanh toán. Quản trị viên sẽ sớm xác nhận.');
            this.closeNotifyPaymentModal();
            // Có thể không cần load lại order ngay, vì trạng thái chưa đổi
          } else {
            this.toastr.error(res.message || 'Gửi thông báo thất bại.');
          }
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Lỗi khi gửi thông báo thanh toán.');
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


    this.confirmationService.open({
      title: 'Xác Nhận Hủy Đơn Hàng',
      message: `Bạn có thực sự muốn hủy đơn hàng #${orderToCancel.orderCode}? Hành động này không thể hoàn tác.`,
      confirmText: 'Xác nhận hủy',
      cancelText: 'Không',
      confirmButtonClass: 'btn-error', // Dùng màu đỏ cho hành động nguy hiểm
      iconClass: 'fas fa-exclamation-triangle', // Icon cảnh báo
      iconColorClass: 'text-error'
    }).subscribe(confirmed => {
      // `confirmed` sẽ là `true` nếu người dùng nhấn "Xác nhận hủy"
      // và là `false` nếu nhấn "Không" hoặc đóng modal.
      if (confirmed) {
        this.isActionLoading.set(true);
        this.errorMessage.set(null);
        this.successMessage.set(null);

        const apiCall = this.isAdmin()
          ? this.orderService.cancelOrderByAdmin(orderToCancel.id)
          : this.orderService.cancelMyOrder(orderToCancel.id);

        apiCall.pipe(
          takeUntil(this.destroy$),
          finalize(() => this.isActionLoading.set(false))
        ).subscribe({
          next: (response) => {
            if (response.success && response.data) {
              this.order.set(response.data);
              this.toastr.success(`Đã hủy đơn hàng #${orderToCancel.orderCode}.`);
            } else {
              this.handleError(response, 'Hủy đơn hàng thất bại.');
            }
          },
          error: (err) => this.handleError(err, 'Lỗi khi hủy đơn hàng.')
        });
      }
      // Nếu `confirmed` là false, không làm gì cả.
    });

  }

  // Mở modal cập nhật trạng thái
  openUpdateStatusModal(): void {
    const currentOrder = this.order();
    if (!currentOrder || !this.canUpdateStatus()) return;

    // Xác định các trạng thái tiếp theo hợp lệ
    this.availableNextStatuses.set(this.getAllowedNextStatuses(currentOrder.status));

    // *** SỬA LẠI LOGIC RESET ***
    // Reset control về null và xóa trạng thái lỗi để nó "sạch" hoàn toàn.
    this.newStatusControl.reset(null);

    this.statusUpdateError.set(null);
    this.showStatusModal.set(true);
  }

  // Đóng modal
  closeStatusModal(): void {
    this.showStatusModal.set(false);
  }

  // Lưu trạng thái mới
  saveNewStatus(): void {
    // Thêm kiểm tra trạng thái hiện tại của control
    if (this.newStatusControl.invalid || !this.order() || !this.newStatusControl.value) {
      this.toastr.warning('Vui lòng chọn một trạng thái mới.');
      return;
    }

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
          this.closeStatusModal(); // Đóng modal sau khi thành công
        } else {
          const message = res.message || 'Lỗi cập nhật trạng thái.';
          this.statusUpdateError.set(message);
          this.toastr.error(message);
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

  // ******  HÀM getLocationName ******
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


  confirmPaymentByAdmin(orderId: number, methodSelectedByAdmin: string, transactionRef?: string, notes?: string): void {
    if (!this.isAdmin() || !this.order()) return;

    const order = this.order()!;
    const paymentMethodConfirmed = methodSelectedByAdmin as PaymentMethod;

    this.isActionLoading.set(true);
    this.adminOrderingService.confirmOrderPayment(orderId, paymentMethodConfirmed, { notes, transactionReference: transactionRef })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isActionLoading.set(false))
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.order.set(res.data);
            this.toastr.success("Đã xác nhận thanh toán cho đơn hàng!");
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
    const paymentMethodText = this.getPaymentMethodText(paymentMethodConfirmed);

    // Thông báo xác nhận cho modal mới
    const confirmMessage = `Bạn có chắc chắn muốn xác nhận đã nhận thanh toán cho đơn hàng #${this.order()?.orderCode} bằng phương thức "${paymentMethodText}"?`;

    this.confirmationService.open({
      title: 'Xác Nhận Thanh Toán',
      message: confirmMessage,
      confirmText: 'Xác nhận',
      confirmButtonClass: 'btn-success',
      iconClass: 'fas fa-money-check-alt',
      iconColorClass: 'text-success',
      inputs: [
        {
          key: 'transactionRef',
          type: 'text',
          label: 'Mã giao dịch/tham chiếu (nếu có)',
          placeholder: 'VD: FT240614...'
        },
        {
          key: 'notes',
          type: 'textarea',
          label: 'Ghi chú của Admin (tùy chọn)',
          placeholder: 'Ghi chú về việc xác nhận thanh toán...'
        }
      ]
    }).subscribe(result => {
      // `result` sẽ là `false` nếu người dùng nhấn Hủy
      // hoặc là một object `{ transactionRef: '...', notes: '...' }` nếu nhấn Đồng ý
      if (result) {
        const transactionRef = result.transactionRef;
        const notes = result.notes;
        // Gọi hàm confirmPaymentByAdmin với dữ liệu từ modal
        this.confirmPaymentByAdmin(orderId, paymentMethodConfirmed, transactionRef, notes);
      } else {
        // Người dùng đã nhấn Hủy, không làm gì cả
        this.toastr.info('Hành động xác nhận thanh toán đã được hủy.');
      }
    });
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



