import { Component, OnInit, inject, signal, computed, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import {ReactiveFormsModule, FormBuilder, FormControl} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Page } from '../../../../core/models/page.model';
import { ProductSummaryResponse } from '../../../catalog/dto/response/ProductSummaryResponse';
import { ProductDetailResponse } from '../../../catalog/dto/response/ProductDetailResponse'; // Import detail DTO
import { AdminCatalogService } from '../../services/admin-catalog.service';
import { ProductStatus, getProductStatusText,  getProductStatusCssClass  } from '../../../catalog/domain/product-status.enum';
import { CategoryResponse } from '../../../catalog/dto/response/CategoryResponse';
import { CategoryService } from '../../../catalog/services/category.service';

import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import {SafeHtmlPipe} from '../../../../shared/pipes/safe-html.pipe';
import {FormatBigDecimalPipe} from '../../../../shared/pipes/format-big-decimal.pipe';
import {ConfirmationService} from '../../../../shared/services/confirmation.service';


@Component({
  selector: 'app-manage-all-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LoadingSpinnerComponent, AlertComponent, PaginatorComponent, ModalComponent, DatePipe, DecimalPipe, SafeHtmlPipe, FormatBigDecimalPipe],
  templateUrl: './manage-all-products.component.html',
})
export class ManageAllProductsComponent implements OnInit, OnDestroy {
  private adminCatalogService = inject(AdminCatalogService);
  private categoryService = inject(CategoryService);
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();
  private confirmationService = inject(ConfirmationService);

  productsPage = signal<Page<ProductSummaryResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  categories = signal<CategoryResponse[]>([]); // Danh sách category cho filter

  // Filter form
  filterForm = this.fb.group({
    keyword: [''],
    status: [''], // Giá trị rỗng là không lọc
    categoryId: [''], // Giá trị rỗng là không lọc
    farmerId: [''] // Lọc theo ID nông dân
  });

  // Phân trang & Sắp xếp
  currentPage = signal(0);
  pageSize = signal(15);
  sort = signal('createdAt,desc');

  // State cho modal chi tiết và xác nhận
  showDetailModal = signal(false);
  showRejectModal = signal(false); // Modal nhập lý do từ chối
  selectedProduct = signal<ProductDetailResponse | null>(null);
  productToReject = signal<{ id: number, name: string } | null>(null);

  rejectReasonControl = new FormControl('');




  // Lấy danh sách ProductStatus để hiển thị trong dropdown filter
  productStatuses = Object.values(ProductStatus);
  getStatusText = getProductStatusText;
  //getStatusClass = getProductStatusCssClass;

  // *** Gán các hàm helper vào thuộc tính public ***
  //getStatusText = getProductStatusText;
  getStatusClass = getProductStatusCssClass;

  ngOnInit(): void {
    this.loadCategories(); // Tải danh sách category cho filter
    this.loadProducts(); // Tải danh sách sản phẩm ban đầu

    // Lắng nghe thay đổi filter để load lại
    this.filterForm.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)), // So sánh sâu hơn
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage.set(0);
      this.loadProducts();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCategories(): void {
    // Lấy danh sách category phẳng
    this.categoryService.getAllCategoriesFlat()
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        if (res.success && res.data) {
          this.categories.set(res.data);
        }
      });
  }

  loadProducts(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const formValue = this.filterForm.value;
    const params = {
      page: this.currentPage(),
      size: this.pageSize(),
      sort: this.sort(),
      keyword: formValue.keyword || undefined,
      status: formValue.status || undefined,
      categoryId: formValue.categoryId ? +formValue.categoryId : undefined, // Chuyển sang number
      farmerId: formValue.farmerId ? +formValue.farmerId : undefined // Chuyển sang number
    };

    this.adminCatalogService.getAllProductsForAdmin(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.productsPage.set(res.data);
          } else {
            this.productsPage.set(null);
            this.errorMessage.set(res.message || 'Không tải được danh sách sản phẩm.');
          }
          this.isLoading.set(false);
        },
        error: (err) => this.handleError(err, 'Lỗi khi tải danh sách sản phẩm.')
      });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);

    this.loadProducts();
  }

  // Mở modal xem chi tiết
  viewProductDetails(productId: number): void {
    this.isLoading.set(true); // Hiện loading tạm thời
    this.adminCatalogService.getProductByIdForAdmin(productId).subscribe({
      next: (res) => {
        if(res.success && res.data) {
          this.selectedProduct.set(res.data);
          this.showDetailModal.set(true);
        } else {
          this.toastr.error(res.message || 'Không thể lấy chi tiết sản phẩm.');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.handleError(err, 'Lỗi khi lấy chi tiết sản phẩm.');
        this.isLoading.set(false);
      }
    });
  }

  // Đóng modal chi tiết
  closeDetailModal(): void {
    this.showDetailModal.set(false);
    this.selectedProduct.set(null);
  }

  // Duyệt sản phẩm
  approveProduct(productId: number): void {
    this.confirmationService.open({
      title: 'Xác Nhận Duyệt Sản Phẩm',
      message: `Bạn có chắc chắn muốn duyệt và cho phép sản phẩm này được hiển thị công khai trên trang web không?`,
      confirmText: 'Duyệt',
      cancelText: 'Hủy',
      confirmButtonClass: 'btn-success', // Dùng màu xanh cho hành động tích cực
      iconClass: 'fas fa-check-circle',  // Icon dấu tích
      iconColorClass: 'text-success'
    }).subscribe(confirmed => {
      if (confirmed) {
        this.isLoading.set(true);
        this.adminCatalogService.approveProduct(productId).subscribe({
          next: (res) => {
            if(res.success) {
              this.toastr.success('Đã duyệt sản phẩm thành công.');
              this.loadProducts(); // Load lại danh sách
            } else {
              this.handleError(res, 'Lỗi khi duyệt sản phẩm.');
            }
            this.isLoading.set(false); // Tắt loading chung
          },
          error: (err) => this.handleError(err, 'Lỗi khi duyệt sản phẩm.')
        });
      }
      // Nếu `confirmed` là false, không làm gì cả.
    });
  }

  // Mở modal nhập lý do từ chối
  openRejectModal(product: ProductSummaryResponse): void {
    this.productToReject.set({ id: product.id, name: product.name });
    this.rejectReasonControl.reset(''); // Reset FormControl
    this.showRejectModal.set(true);
  }


  // Đóng modal từ chối
  closeRejectModal(): void {
    this.showRejectModal.set(false);
    this.productToReject.set(null);
    this.rejectReasonControl.reset('');
  }


  // Từ chối sản phẩm
  rejectProduct(): void {
    const productInfo = this.productToReject();
    if (!productInfo) return;

    this.isLoading.set(true); // Dùng loading chung
    const reason = this.rejectReasonControl.value || null;
    this.adminCatalogService.rejectProduct(productInfo.id, reason).subscribe({
      next: (res) => {
        if(res.success) {
          this.toastr.success(`Đã từ chối sản phẩm "${productInfo.name}".`);
          this.closeRejectModal();
          this.loadProducts(); // Load lại danh sách
        } else {
          this.handleError(res, 'Lỗi khi từ chối sản phẩm.');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.handleError(err, 'Lỗi khi từ chối sản phẩm.');
        this.isLoading.set(false); // Đảm bảo tắt loading
        // Không đóng modal lỗi để user thấy
      }
    });
  }

// Xóa vĩnh viễn sản phẩm
  forceDeleteProduct(productId: number, productName: string): void {
    this.confirmationService.open({
      title: 'Xác Nhận Xóa Vĩnh Viễn',
      // Sử dụng \n để xuống dòng trong message, và template của modal đã có `whitespace-pre-line` để xử lý
      message: `!!! CẢNH BÁO !!!\nBạn có chắc chắn muốn XÓA VĨNH VIỄN sản phẩm "${productName}"?\nHành động này không thể hoàn tác và sẽ xóa mọi dữ liệu liên quan (ảnh...).`,
      confirmText: 'Xóa Vĩnh Viễn',
      cancelText: 'Hủy',
      confirmButtonClass: 'btn-error', // Dùng màu đỏ cho hành động nguy hiểm
      iconClass: 'fas fa-skull-crossbones', // Icon cảnh báo nguy hiểm
      iconColorClass: 'text-error'
    }).subscribe(confirmed => {
      if (confirmed) {
        this.isLoading.set(true);
        this.adminCatalogService.forceDeleteProduct(productId).subscribe({
          next: (res) => {
            if(res.success) {
              this.toastr.success(`Đã xóa vĩnh viễn sản phẩm "${productName}".`);
              this.loadProducts(); // Load lại danh sách
            } else {
              this.handleError(res, 'Lỗi khi xóa sản phẩm.');
            }
            this.isLoading.set(false);
          },
          error: (err) => {
            this.handleError(err, 'Lỗi khi xóa sản phẩm.');
            this.isLoading.set(false);
          }
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
    this.isLoading.set(false);
    console.error(err);
  }

  // Thêm hàm reset bộ lọc
  resetFilters(): void {
    this.filterForm.reset({
      keyword: '',
      status: '',
      categoryId: '',
      farmerId: ''
    });
    // valueChanges sẽ tự động trigger loadProducts() với giá trị rỗng
  }


  trackProductById(index: number, item: ProductSummaryResponse): number {
    return item.id;
  }
  trackCategoryById(index: number, item: CategoryResponse): number {
    return item.id;
  }
}
