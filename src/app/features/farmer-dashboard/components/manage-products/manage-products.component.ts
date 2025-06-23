import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Page } from '../../../../core/models/page.model';
import { ProductSummaryResponse } from '../../../catalog/dto/response/ProductSummaryResponse';
import {ProductSearchParams, ProductService} from '../../../catalog/services/product.service';
import { ProductStatus, getProductStatusText, getProductStatusCssClass } from '../../../catalog/domain/product-status.enum';

import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil, finalize } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import {FormatBigDecimalPipe} from '../../../../shared/pipes/format-big-decimal.pipe';
import {ConfirmationService} from '../../../../shared/services/confirmation.service';

@Component({
  selector: 'app-manage-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LoadingSpinnerComponent, AlertComponent, PaginatorComponent, DatePipe, DecimalPipe, FormatBigDecimalPipe],
  templateUrl: './manage-products.component.html',
})
export class ManageProductsComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private router = inject(Router);
  private authService = inject(AuthService);
  private destroy$ = new Subject<void>();
  private confirmationService = inject(ConfirmationService);

  productsPage = signal<Page<ProductSummaryResponse> | null>(null);
  isLoading = signal(true);
  deleteLoading = signal<Record<number, boolean>>({}); // Loading khi xóa từng sản phẩm
  errorMessage = signal<string | null>(null);

  // Filter form
  filterForm = this.fb.group({
    keyword: [''],
    status: [''] // Lọc theo trạng thái
  });

  // Phân trang & Sắp xếp
  currentPage = signal(0);
  pageSize = signal(10); // Ít hơn trang admin
  sort = signal('updatedAt,desc'); // Sắp xếp theo lần cập nhật gần nhất

  // Lấy danh sách ProductStatus để hiển thị trong dropdown filter
  productStatuses = Object.values(ProductStatus); // Hiển thị tất cả để farmer lọc
  getStatusText = getProductStatusText;
  getStatusClass = getProductStatusCssClass;

  ngOnInit(): void {
    // Cần đảm bảo user là Farmer (Guard đã xử lý ở route)
    this.loadMyProducts();

    // Lắng nghe thay đổi filter để load lại
    this.filterForm.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage.set(0);
      this.loadMyProducts();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadMyProducts(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const formValue = this.filterForm.value;
    const params: any  = {
      page: this.currentPage(),
      size: this.pageSize(),
      sort: this.sort(),
      // Thêm filter
      // keyword: formValue.keyword || undefined,
      // status: formValue.status || undefined
    };
    if (formValue.keyword?.trim()) {
      params.keyword = formValue.keyword.trim();
    }
    if (formValue.status) {
      params.status = formValue.status;
    }

    this.productService.getMyB2CProducts(params as ProductSearchParams)

    // Gọi API lấy sản phẩm CỦA TÔI
    this.productService.getMyB2CProducts(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.productsPage.set(res.data);
          } else {
            this.productsPage.set(null);
            if(res.status !== 404 && !res.success) this.errorMessage.set(res.message || 'Không tải được danh sách sản phẩm.');
          }
          this.isLoading.set(false);
        },
        error: (err) => this.handleError(err, 'Lỗi khi tải danh sách sản phẩm.')
      });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadMyProducts();
  }

  // Hàm để lấy trạng thái loading xóa của item cụ thể
  isDeleting(productId: number): boolean {
    return this.deleteLoading()[productId] ?? false;
  }
  private setDeleting(productId: number, value: boolean): void {
    this.deleteLoading.update(current => ({ ...current, [productId]: value }));
  }


// Xóa mềm sản phẩm
  deleteProduct(product: ProductSummaryResponse): void {
    this.confirmationService.open({
      title: 'Xác Nhận Xóa Sản Phẩm',
      message: `Bạn có chắc chắn muốn xóa sản phẩm "${product.name}"? Sản phẩm sẽ được chuyển vào thùng rác và không còn hiển thị để bán.`,
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      confirmButtonClass: 'btn-error',
      iconClass: 'fas fa-trash-alt',
      iconColorClass: 'text-error'
    }).subscribe(confirmed => {
      if (confirmed) {
        this.setDeleting(product.id, true);
        this.errorMessage.set(null); // Xóa lỗi cũ
        this.productService.deleteMyProduct(product.id)
          .pipe(
            takeUntil(this.destroy$),
            finalize(() => this.setDeleting(product.id, false))
          )
          .subscribe({
            next: (res) => {
              if(res.success) {
                this.toastr.success(`Đã xóa sản phẩm "${product.name}".`);
                this.loadMyProducts(); // Load lại danh sách
              } else {
                this.handleError(res, 'Lỗi khi xóa sản phẩm.');
              }
            },
            error: (err) => this.handleError(err, 'Lỗi khi xóa sản phẩm.')
          });
      }
      // Nếu `confirmed` là false, không làm gì cả.
    });
  }
  // Helper xử lý lỗi
  private handleError(err: any, defaultMessage: string): void {
    const message = err?.message || defaultMessage;
    this.errorMessage.set(message);
    this.toastr.error(message);
    this.isLoading.set(false); // Tắt loading chung
    // Không cần tắt loading xóa vì dùng finalize
    console.error(err);
  }

  trackProductById(index: number, item: ProductSummaryResponse): number {
    return item.id;
  }
}
