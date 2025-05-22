
import { Component, OnInit, inject, signal, OnDestroy, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { AdminInvoiceService, AdminInvoiceSearchParams } from '../../services/admin-invoice.service';

import { Page } from '../../../../core/models/page.model';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ToastrService } from 'ngx-toastr';
import { AdminOrderingService } from '../../services/admin-ordering.service'; // Để xác nhận thanh toán
import { PaymentMethod } from '../../../ordering/domain/payment-method.enum';
import {InvoiceSummaryResponse} from '../../../ordering/dto/response/InvoiceSummaryResponse';
import {InvoiceStatus} from '../../../ordering/domain/invoice-status.enum';


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

  // Pagination and Sort
  currentPage = signal(0);
  pageSize = signal(15);
  sort = signal('issueDate,desc'); // Mặc định sắp xếp

  // Action state
  isActionLoading = signal(false);
  actionInvoiceId = signal<number | null>(null);

  constructor() {
    console.log('[ManageInvoiceListComponent] Constructor called.');
    this.filterForm = this.fb.group({
      keyword: [''],
      status: [''] // Giá trị rỗng cho "Tất cả trạng thái"
    });
    console.log('[ManageInvoiceListComponent] Filter form initialized in constructor.');
  }

  ngOnInit(): void {
    console.log('[ManageInvoiceListComponent] ngOnInit called.');
    // alert('[ManageInvoiceListComponent] ngOnInit CALLED!'); // Dùng alert nếu console không hiện

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
    console.log('[ManageInvoiceListComponent] loadInvoices called. Current page:', this.currentPage(), 'Filters:', this.filterForm.value);
    this.isLoading.set(true);
    this.errorMessage.set(null);
    // Không reset invoicesPage.set(null) ở đây vội, để UI không bị giật nếu load lại
    // this.invoicesPage.set(null);

    const formValue = this.filterForm.value;
    const params: AdminInvoiceSearchParams = {
      page: this.currentPage(),
      size: this.pageSize(),
      sort: this.sort(),
      keyword: formValue.keyword?.trim() || null,
      status: formValue.status || null // Nếu status là chuỗi rỗng, truyền null
    };
    console.log('[ManageInvoiceListComponent] Params for API call:', params);

    this.adminInvoiceService.getAllInvoices(params)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          console.log('[ManageInvoiceListComponent] API call finalized. isLoading set to false.');
          this.isLoading.set(false);
        })
      )
      .subscribe({
        next: (res) => {
          console.log('[ManageInvoiceListComponent] API Response received:', JSON.stringify(res, null, 2));
          if (res.success && res.data) {
            console.log('[ManageInvoiceListComponent] Setting invoicesPage with data. Content length:', res.data.content?.length);
            this.invoicesPage.set(res.data);
            if (res.data.content?.length === 0) {
              console.log('[ManageInvoiceListComponent] API returned data with empty content.');
            }
          } else {
            const msg = res.message || 'Không tải được danh sách hóa đơn.';
            console.error('[ManageInvoiceListComponent] API call was not successful or no data:', msg);
            this.errorMessage.set(msg);
            this.invoicesPage.set(null); // Set là null nếu có lỗi logic từ API
          }
        },
        error: (err) => {
          // err.error có thể chứa object ApiResponse từ backend nếu là lỗi HTTP 4xx, 5xx
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
    this.filterForm.reset({ keyword: '', status: '' });
    // valueChanges sẽ tự động trigger loadInvoices
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
    if (!status) return 'badge-ghost'; // Màu trung tính hơn cho N/A
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
    console.log('[ManageInvoiceListComponent] confirmPayment called for invoice:', invoice.invoiceNumber);
    if (invoice.status === InvoiceStatus.PAID) {
      this.toastr.info('Hóa đơn này đã được thanh toán.');
      return;
    }

    const paymentMethodConfirmedStr = prompt(`Khách hàng đã thanh toán hóa đơn ${invoice.invoiceNumber} bằng phương thức nào? (BANK_TRANSFER, COD, OTHER)`, PaymentMethod.BANK_TRANSFER.toString());
    if (!paymentMethodConfirmedStr) {
      console.log('[ManageInvoiceListComponent] Confirm payment cancelled by user (no payment method).');
      return;
    }

    const paymentMethodConfirmed = paymentMethodConfirmedStr.toUpperCase() as PaymentMethod;
    if (!Object.values(PaymentMethod).includes(paymentMethodConfirmed)) {
      this.toastr.error("Phương thức thanh toán không hợp lệ: " + paymentMethodConfirmedStr);
      console.error('[ManageInvoiceListComponent] Invalid payment method entered:', paymentMethodConfirmedStr);
      return;
    }

    const transactionRef = prompt(`Nhập mã giao dịch (nếu có) cho hóa đơn ${invoice.invoiceNumber}:`);
    const notes = prompt(`Ghi chú thêm (nếu có) cho hóa đơn ${invoice.invoiceNumber}:`);

    if (confirm(`Xác nhận khách hàng đã thanh toán hóa đơn ${invoice.invoiceNumber} (Đơn hàng ${invoice.orderCode}) bằng ${this.getInvoiceStatusText(paymentMethodConfirmed)}?`)) {
      console.log('[ManageInvoiceListComponent] User confirmed payment. Calling API...');
      this.isActionLoading.set(true);
      this.actionInvoiceId.set(invoice.invoiceId);

      this.adminOrderingService.confirmOrderPayment(invoice.orderId, paymentMethodConfirmed, { notes, transactionReference: transactionRef })
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => {
            console.log('[ManageInvoiceListComponent] Confirm payment API call finalized.');
            this.isActionLoading.set(false);
            this.actionInvoiceId.set(null);
          })
        )
        .subscribe({
          next: (res) => {
            console.log('[ManageInvoiceListComponent] Confirm payment API response:', res);
            if (res.success) {
              this.toastr.success(`Đã xác nhận thanh toán cho hóa đơn ${invoice.invoiceNumber}.`);
              this.loadInvoices(); // Load lại danh sách
            } else {
              this.toastr.error(res.message || 'Lỗi khi xác nhận thanh toán.');
            }
          },
          error: (err) => {
            console.error('[ManageInvoiceListComponent] Confirm payment API error:', err);
            this.toastr.error(err.error?.message || 'Lỗi hệ thống khi xác nhận thanh toán.');
          }
        });
    } else {
      console.log('[ManageInvoiceListComponent] User cancelled payment confirmation.');
    }
  }

  trackInvoiceById(index: number, item: InvoiceSummaryResponse): number {
    return item.invoiceId;
  }
}
