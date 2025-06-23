
import { Component, OnInit, inject, signal, OnDestroy, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import {RouterLink, ActivatedRoute} from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import {Observable, Subject} from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import {
  AdminInvoiceService,
  AdminInvoiceSearchParams,
  FarmerInvoiceSearchParams
} from '../../services/admin-invoice.service';

import { Page } from '../../../../core/models/page.model';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ToastrService } from 'ngx-toastr';
import { AdminOrderingService } from '../../services/admin-ordering.service';
import { PaymentMethod } from '../../../ordering/domain/payment-method.enum';
import {InvoiceSummaryResponse} from '../../../ordering/dto/response/InvoiceSummaryResponse';
import {InvoiceStatus} from '../../../ordering/domain/invoice-status.enum';
import {AuthService} from '../../../../core/services/auth.service';
import {BuyerInvoiceSearchParams, OrderService} from '../../../ordering/services/order.service';
import {PagedApiResponse} from '../../../../core/models/api-response.model';
import {getPaymentStatusText, PaymentStatus} from '../../../ordering/domain/payment-status.enum';
import {ConfirmationService} from '../../../../shared/services/confirmation.service';


// Định nghĩa các tùy chọn lọc trạng thái thanh toán cho hóa đơn công nợ
export enum InvoicePaymentFilterStatus {
  ALL = 'ALL',
  UNPAID = 'UNPAID', // Bao gồm AWAITING_PAYMENT_TERM và PENDING của Order liên quan đến Invoice
  PAID = 'PAID',     // Tương ứng Order.paymentStatus = PAID
  OVERDUE_INVOICE = 'OVERDUE_INVOICE' // Lọc theo Invoice.status = OVERDUE
}

export function getInvoicePaymentFilterStatusText(status: InvoicePaymentFilterStatus | string | null | undefined): string {
  if (!status) return 'Tất cả trạng thái TT';
  switch (status) {
    case InvoicePaymentFilterStatus.ALL: return 'Tất cả trạng thái TT';
    case InvoicePaymentFilterStatus.UNPAID: return 'Chưa thanh toán';
    case InvoicePaymentFilterStatus.PAID: return 'Đã thanh toán';
    case InvoicePaymentFilterStatus.OVERDUE_INVOICE: return 'Hóa đơn quá hạn';
    default: return 'Không xác định';
  }
}

@Component({
  selector: 'app-manage-invoice-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    PaginatorComponent,
    LoadingSpinnerComponent,
    AlertComponent,
    DatePipe,
    DecimalPipe
  ],
  templateUrl: './manage-invoice-list.component.html',
})
export class ManageInvoiceListComponent implements OnInit, OnDestroy {
  private adminInvoiceService = inject(AdminInvoiceService);
  private adminOrderingService = inject(AdminOrderingService);

  private fb = inject(FormBuilder);
  // private router = inject(Router); // Tạm thời không dùng router trong debug
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();
  // private datePipe = inject(DatePipe); // Tạm thời không dùng datePipe trong logic TS
  private route = inject(ActivatedRoute); // Inject ActivatedRoute
  private authService = inject(AuthService); // Inject AuthService

  private orderService = inject(OrderService);

  private confirmationService = inject(ConfirmationService);

  // Signals
  invoicesPage = signal<Page<InvoiceSummaryResponse> | null>(null);
  isLoading = signal(true); // Bắt đầu với isLoading = true
  errorMessage = signal<string | null>(null);
  filterForm!: FormGroup;

  // Constants for template
  invoiceStatusOptions = Object.values(InvoiceStatus);
  today = new Date(); // Dùng cho so sánh ngày quá hạn trong template
  InvoiceStatusEnum = InvoiceStatus; // Expose enum cho template
  PaymentMethodEnum = PaymentMethod; // Expose enum cho template
  paymentStatusOptions = Object.values(PaymentStatus);
  PaymentStatusEnum = PaymentStatus;
  getPaymentStatusText = getPaymentStatusText;

  // Pagination and Sort
  currentPage = signal(0);
  pageSize = signal(15);
  sort = signal('issueDate,desc'); // Mặc định sắp xếp

  // Action state
  isActionLoading = signal(false);
  actionInvoiceId = signal<number | null>(null);

  viewMode = signal<'admin' | 'farmer'| 'buyer'>('admin'); // Mặc định là admin
  isAdminView = computed(() => this.viewMode() === 'admin');
  isFarmerView = computed(() => this.viewMode() === 'farmer');
  isBuyerView = computed(() => this.viewMode() === 'buyer');

  invoicePaymentFilterOptions = Object.values(InvoicePaymentFilterStatus);
  getInvoicePaymentFilterStatusText = getInvoicePaymentFilterStatusText;

  constructor() {
    console.log('[ManageInvoiceListComponent] Constructor called.');
    this.filterForm = this.fb.group({
      keyword: [''],
      status: [''], // Giá trị rỗng cho "Tất cả trạng thái"
      paymentStatusFilter: ['']
    });
    console.log('[ManageInvoiceListComponent] Filter form initialized in constructor.');
  }

  ngOnInit(): void {
    // Xác định viewMode dựa trên route data
    const routeDataViewMode = this.route.snapshot.data['viewMode'];
    if (routeDataViewMode === 'farmer') {
      this.viewMode.set('farmer');
    } else if (routeDataViewMode === 'buyer') {
      this.viewMode.set('buyer');
    } else {
      this.viewMode.set('admin'); // Mặc định hoặc nếu không có data
    }
    console.log('[ManageInvoiceListComponent] View Mode:', this.viewMode());


    this.loadInvoices(); // Gọi load invoices lần đầu

    this.filterForm.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      takeUntil(this.destroy$)
    ).subscribe(filterValue => {
      console.log('[ManageInvoiceListComponent] Filter form value changed:', filterValue);
      this.currentPage.set(0); // Reset về trang đầu khi filter
      this.loadInvoices();
    });
    console.log('[ManageInvoiceListComponent] Subscribed to filterForm valueChanges.');
  }

  ngOnDestroy(): void {
    console.log('[ManageInvoiceListComponent] ngOnDestroy called.');
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadInvoices(): void {

    this.isLoading.set(true);
    this.errorMessage.set(null);


    const formValue = this.filterForm.value;

    let targetInvoiceStatus: InvoiceStatus | string | null = formValue.status || null;
    let targetOrderPaymentStatus: PaymentStatus | string | null = null;

    // Xử lý logic cho paymentStatusFilter
    const paymentFilter = formValue.paymentStatusFilter as InvoicePaymentFilterStatus | null;
    if (paymentFilter) {
      switch (paymentFilter) {
        case InvoicePaymentFilterStatus.UNPAID:

          targetOrderPaymentStatus = PaymentStatus.AWAITING_PAYMENT_TERM;

          if (targetInvoiceStatus && targetInvoiceStatus === InvoiceStatus.PAID) {

            targetInvoiceStatus = null;
            this.filterForm.get('status')?.setValue('', { emitEvent: false }); // Cập nhật UI
          }
          break;
        case InvoicePaymentFilterStatus.PAID:
          targetOrderPaymentStatus = PaymentStatus.PAID;
          // Khi đơn hàng đã thanh toán, hóa đơn cũng nên là PAID
          if (targetInvoiceStatus && targetInvoiceStatus !== InvoiceStatus.PAID) {
            targetInvoiceStatus = InvoiceStatus.PAID; // Ưu tiên hiển thị hóa đơn đã thanh toán
            this.filterForm.get('status')?.setValue(InvoiceStatus.PAID, { emitEvent: false });
          } else if (!targetInvoiceStatus) {
            targetInvoiceStatus = InvoiceStatus.PAID; // Nếu chưa chọn InvoiceStatus, mặc định là PAID
          }
          break;
        case InvoicePaymentFilterStatus.OVERDUE_INVOICE:
          targetInvoiceStatus = InvoiceStatus.OVERDUE; // Lọc trực tiếp theo Invoice.status
          // Khi hóa đơn quá hạn, đơn hàng thường là chưa thanh toán
          if (targetOrderPaymentStatus && targetOrderPaymentStatus === PaymentStatus.PAID) {
            targetOrderPaymentStatus = null; // Không hợp lý nếu HĐ quá hạn mà ĐH đã thanh toán
            this.filterForm.get('paymentStatusFilter')?.setValue(InvoicePaymentFilterStatus.UNPAID, { emitEvent: false });
          } else if (!targetOrderPaymentStatus) {
            targetOrderPaymentStatus = PaymentStatus.AWAITING_PAYMENT_TERM; // Hoặc PENDING
          }
          break;
        default: // ALL
          targetOrderPaymentStatus = null;
          break;
      }
    }

    const commonParams: AdminInvoiceSearchParams | FarmerInvoiceSearchParams | BuyerInvoiceSearchParams = {
      page: this.currentPage(),
      size: this.pageSize(),
      sort: this.sort(),
      keyword: formValue.keyword?.trim() || null,
      status: targetInvoiceStatus, // Sử dụng InvoiceStatus đã xử lý
      paymentStatus: targetOrderPaymentStatus // Sử dụng OrderPaymentStatus đã xử lý
    };


    let apiCallObservable: Observable<PagedApiResponse<InvoiceSummaryResponse>>;

    if (this.isAdminView()) {
      apiCallObservable = this.adminInvoiceService.getAllInvoices(commonParams as AdminInvoiceSearchParams);
    } else if (this.isFarmerView()) {
      apiCallObservable = this.adminInvoiceService.getMyInvoicesAsFarmer(commonParams as FarmerInvoiceSearchParams);
    } else { // Mặc định là Buyer view nếu không phải Admin/Farmer
      apiCallObservable = this.orderService.getMyDebtInvoices(commonParams as BuyerInvoiceSearchParams);
    }

    apiCallObservable.pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        console.log('[ManageInvoiceListComponent] API call finalized. isLoading set to false.');
        this.isLoading.set(false);
      })
    ).subscribe({
      next: (res) => {
        console.log('[ManageInvoiceListComponent] API Response received:', JSON.stringify(res, null, 2));
        if (res.success && res.data) {
          console.log('[ManageInvoiceListComponent] Setting invoicesPage with data. Content length:', res.data.content?.length);
          this.invoicesPage.set(res.data);
          if (res.data.content?.length === 0) {
            console.log('[ManageInvoiceListComponent] API returned data with empty content.');
          }
        } else {
          const msg = res.message || (this.isAdminView() ? 'Không tải được danh sách hóa đơn (Admin).' : (this.isFarmerView() ? 'Không tải được danh sách hóa đơn của bạn (Farmer).' : 'Không tải được danh sách hóa đơn công nợ của bạn (Buyer).'));
          console.error('[ManageInvoiceListComponent] API call was not successful or no data:', msg);
          this.errorMessage.set(msg);
          this.invoicesPage.set(null);
        }
      },
      error: (err) => {
        const apiErrorMessage = err.error?.message || err.message;
        console.error('[ManageInvoiceListComponent] API Error:', JSON.stringify(err, null, 2));
        this.errorMessage.set(apiErrorMessage || 'Lỗi kết nối hoặc lỗi không xác định khi tải danh sách hóa đơn.');
        this.invoicesPage.set(null);
      }
    });
  }

  onPageChange(page: number): void {
    console.log('[ManageInvoiceListComponent] Page changed to:', page);
    this.currentPage.set(page);
    this.loadInvoices();
  }

  clearFilters(): void {
    console.log('[ManageInvoiceListComponent] Clearing filters.');
    this.filterForm.reset({ keyword: '', status: '', paymentStatusFilter: '' });

  }

  // Các hàm helper cho template
  getInvoiceStatusText(status: InvoiceStatus | string | null | undefined): string {
    if (!status) return 'N/A';
    switch (status) {
      case InvoiceStatus.DRAFT: return 'Nháp';
      case InvoiceStatus.ISSUED: return 'Đã phát hành';
      case InvoiceStatus.PAID: return 'Đã thanh toán';
      case InvoiceStatus.VOID: return 'Đã hủy';
      case InvoiceStatus.OVERDUE: return 'Quá hạn';
      default: return status.toString();
    }
  }

  getInvoiceStatusClass(status: InvoiceStatus | string | null | undefined): string {
    if (!status) return 'badge-ghost';
    switch (status) {
      case InvoiceStatus.PAID: return 'badge-success';
      case InvoiceStatus.OVERDUE: return 'badge-error';
      case InvoiceStatus.ISSUED: return 'badge-info';
      case InvoiceStatus.VOID: return 'badge-ghost';
      case InvoiceStatus.DRAFT: return 'badge-warning';
      default: return 'badge-neutral';
    }
  }

  isDueDatePast(dueDateStr: string | null | undefined, comparisonDate: Date): boolean {
    if (!dueDateStr) return false;
    try {
      const dueDate = new Date(dueDateStr);
      const normalizedDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const normalizedComparisonDate = new Date(comparisonDate.getFullYear(), comparisonDate.getMonth(), comparisonDate.getDate());
      return normalizedDueDate < normalizedComparisonDate;
    } catch (e) {
      console.error("[ManageInvoiceListComponent] Error parsing dueDate in isDueDatePast:", dueDateStr, e);
      return false;
    }
  }



  confirmPayment(invoice: InvoiceSummaryResponse): void {
    if (!this.isAdminView()) {
      this.toastr.warning('Bạn không có quyền thực hiện hành động này.');
      return;
    }
    if (invoice.status === InvoiceStatus.PAID) {
      this.toastr.info('Hóa đơn này đã được thanh toán.');
      return;
    }


    this.confirmationService.open({
      title: 'Xác Nhận Thanh Toán',
      message: `Xác nhận khách hàng đã thanh toán cho hóa đơn #${invoice.invoiceNumber} (Đơn hàng #${invoice.orderCode})?`,
      confirmText: 'Xác nhận',
      cancelText: 'Hủy',
      confirmButtonClass: 'btn-success',
      iconClass: 'fas fa-money-check-alt',
      iconColorClass: 'text-success',
      inputs: [
        {
          key: 'paymentMethod',
          type: 'text',
          label: 'Phương thức thanh toán thực tế',
          placeholder: 'VD: BANK_TRANSFER, COD, OTHER',
          initialValue: PaymentMethod.BANK_TRANSFER.toString()
        },
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

      if (result) {
        const paymentMethodConfirmed = result.paymentMethod.toUpperCase() as PaymentMethod;
        if (!Object.values(PaymentMethod).includes(paymentMethodConfirmed)) {
          this.toastr.error("Phương thức thanh toán không hợp lệ: " + result.paymentMethod);
          return;
        }

        const transactionRef = result.transactionRef;
        const notes = result.notes;

        this.isActionLoading.set(true);
        this.actionInvoiceId.set(invoice.invoiceId);

        this.adminOrderingService.confirmOrderPayment(invoice.orderId, paymentMethodConfirmed, { notes, transactionReference: transactionRef })
          .pipe(
            takeUntil(this.destroy$),
            finalize(() => {
              this.isActionLoading.set(false);
              this.actionInvoiceId.set(null);
            })
          )
          .subscribe({
            next: (res) => {
              if (res.success) {
                this.toastr.success(`Đã xác nhận thanh toán cho hóa đơn ${invoice.invoiceNumber}.`);
                this.loadInvoices(); // Tải lại danh sách
              } else {
                this.toastr.error(res.message || 'Lỗi khi xác nhận thanh toán.');
              }
            },
            error: (err) => {
              this.toastr.error(err.error?.message || 'Lỗi hệ thống khi xác nhận thanh toán.');
            }
          });
      }
      // Nếu `result` là false, không làm gì cả.
    });

  }

  // Điều chỉnh routerLink cho nút xem chi tiết đơn hàng
  getOrderDetailsLink(orderId: number): string[] {
    if (this.isAdminView()) {
      return ['/admin/orders', orderId.toString()];
    } else if (this.isFarmerView()) {
      return ['/farmer/orders', orderId.toString()];
    } else { // Buyer view
      return ['/user/orders', orderId.toString()];
    }
  }

  trackInvoiceById(index: number, item: InvoiceSummaryResponse): number {
    return item.invoiceId;
  }
}
