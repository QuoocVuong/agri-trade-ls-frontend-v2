// src/app/features/farmer-dashboard/components/manage-supply/manage-supply.component.ts
import { Component, OnInit, inject, signal, OnDestroy, effect } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

import { ProductService, ProductSearchParams } from '../../../catalog/services/product.service';
import { ProductSummaryResponse } from '../../../catalog/dto/response/ProductSummaryResponse';
import { PageData, PagedApiResponse } from '../../../../core/models/api-response.model';
import { ProductStatus, getProductStatusText, getProductStatusCssClass } from '../../../catalog/domain/product-status.enum';

import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';
import {FormsModule} from '@angular/forms';
import {convertKgToUnit, getMassUnitText, MassUnit} from '../../../catalog/domain/mass-unit.enum';
import {ConfirmationService} from '../../../../shared/services/confirmation.service';

@Component({
  selector: 'app-manage-supply',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LoadingSpinnerComponent,
    AlertComponent,
    PaginatorComponent,
    DatePipe,
    DecimalPipe,
    FormatBigDecimalPipe,
    FormsModule
  ],
  templateUrl: './farmer-supply-list.component.html',
  // styleUrls: ['./manage-supply.component.css']
})
export class FarmerSupplyListComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();
  private confirmationService = inject(ConfirmationService);

  supplies = signal<ProductSummaryResponse[]>([]);
  paginationData = signal<PageData<ProductSummaryResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  // Filter and Sort states
  currentPage = signal(0);
  pageSize = signal(10); // Or your preferred default
  currentSort = signal('updatedAt,desc'); // Sắp xếp theo ngày cập nhật mới nhất
  currentStatusFilter = signal<ProductStatus | string | null>(null); // Lọc theo trạng thái sản phẩm
  currentKeyword = signal<string>('');

  // Helpers for template
  ProductStatusEnum = ProductStatus;
  getStatusText = getProductStatusText;
  getStatusCssClass = getProductStatusCssClass;
  objectKeys = Object.keys as <T extends object>(obj: T) => Array<keyof T>;

  getUnitText = getMassUnitText;


  constructor() {
    // Effect để load lại khi params thay đổi
    effect(() => {
      this.loadFarmerSupplies();
    });
  }

  ngOnInit(): void {
    // Không cần gọi loadFarmerSupplies() ở đây vì effect sẽ làm
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadFarmerSupplies(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const params: ProductSearchParams = {
      page: this.currentPage(),
      size: this.pageSize(),
      sort: this.currentSort(),
      status: this.currentStatusFilter() || undefined, // Gửi undefined nếu null
      keyword: this.currentKeyword().trim() || undefined
    };

    this.productService.getMySupplyProducts(params) // API này lấy sản phẩm của farmer đang đăng nhập
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.supplies.set(response.data.content);
            this.paginationData.set(response.data);
          } else {
            this.supplies.set([]);
            this.paginationData.set(null);
            this.errorMessage.set(response.message || 'Không tải được danh sách nguồn cung.');
          }
        },
        error: (err) => {
          this.supplies.set([]);
          this.paginationData.set(null);
          this.errorMessage.set(err.error?.message || 'Đã có lỗi xảy ra.');
        }
      });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  onSortChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.currentSort.set(selectElement.value);
    this.currentPage.set(0); // Reset về trang đầu khi đổi sort
  }

  onStatusFilterChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const value = selectElement.value;
    this.currentStatusFilter.set(value === 'ALL' || !value ? null : value as ProductStatus);
    this.currentPage.set(0);
  }

  onSearchKeyword(event: Event): void {
    const keyword = (event.target as HTMLInputElement).value;
    this.currentKeyword.set(keyword);
    this.currentPage.set(0); // Reset về trang đầu khi tìm kiếm
    // Có thể thêm debounceTime ở đây nếu muốn
  }

  clearFilters(): void {
    this.currentStatusFilter.set(null);
    this.currentKeyword.set('');
    this.currentSort.set('updatedAt,desc');
    this.currentPage.set(0);
    // Reset input tìm kiếm nếu có
    const searchInput = document.getElementById('supplySearchKeyword') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';
    const statusSelect = document.getElementById('supplyStatusFilter') as HTMLSelectElement | null;
    if (statusSelect) statusSelect.value = '';
    const sortSelect = document.getElementById('supplySort') as HTMLSelectElement | null;
    if (sortSelect) sortSelect.value = 'updatedAt,desc';
  }

  editSupply(productId: number): void {
    this.router.navigate(['/farmer/supply/edit', productId]);
  }

// ... trong class FarmerSupplyListComponent ...

  deleteSupply(productId: number, productName: string): void {
    this.confirmationService.open({
      title: 'Xác Nhận Xóa Nguồn Cung',
      message: `Bạn có chắc chắn muốn xóa nguồn cung "${productName}" không? Hành động này sẽ ẩn nguồn cung khỏi trang tìm kiếm.`,
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      confirmButtonClass: 'btn-error',
      iconClass: 'fas fa-trash-alt',
      iconColorClass: 'text-error'
    }).subscribe(confirmed => {
      if (confirmed) {
        this.isLoading.set(true); // Hoặc một signal loading riêng cho delete
        this.productService.deleteMyProduct(productId) // API này soft delete
          .pipe(
            takeUntil(this.destroy$),
            finalize(() => this.isLoading.set(false))
          )
          .subscribe({
            next: (res) => {
              if (res.success) {
                this.toastr.success(`Đã xóa nguồn cung "${productName}".`);
                this.loadFarmerSupplies(); // Tải lại danh sách
              } else {
                this.toastr.error(res.message || 'Xóa nguồn cung thất bại.');
              }
            },
            error: (err) => {
              this.toastr.error(err.error?.message || 'Lỗi khi xóa nguồn cung.');
            }
          });
      }
      // Nếu `confirmed` là false, không làm gì cả.
    });
  }

  // Trong template hoặc một hàm helper:
  getDisplayStock(supply: ProductSummaryResponse): string {
    if (supply.stockQuantity == null) return 'N/A';
    const stockInBase = supply.stockQuantity; // Giả sử đây là KG
    const targetUnit = (supply.wholesaleUnit || supply.b2bUnit || supply.unit) as MassUnit;

    if (targetUnit && targetUnit !== MassUnit.KG) { // Chỉ quy đổi nếu đơn vị sỉ không phải KG
      try {
        // Cần hàm convertKgToUnit(kgValue: number, targetUnit: MassUnit): number
        const stockInTargetUnit = convertKgToUnit(stockInBase, targetUnit);
        return `${stockInTargetUnit.toLocaleString()} ${this.getUnitText(targetUnit)}`;
      } catch (e) {
        // Nếu lỗi quy đổi, hiển thị theo đơn vị gốc
        return `${stockInBase.toLocaleString()} ${this.getUnitText(MassUnit.KG)} (Lỗi quy đổi đơn vị sỉ)`;
      }
    }
    return `${stockInBase.toLocaleString()} ${this.getUnitText(MassUnit.KG)}`; // Mặc định là KG
  }

  trackSupplyById(index: number, item: ProductSummaryResponse): number {
    return item.id;
  }
}
