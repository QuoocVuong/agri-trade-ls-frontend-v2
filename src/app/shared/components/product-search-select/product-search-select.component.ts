
import { Component, EventEmitter, Input, Output, inject, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, filter, catchError } from 'rxjs/operators';
import { ProductService, ProductSearchParams } from '../../../features/catalog/services/product.service';
import { ProductSummaryResponse } from '../../../features/catalog/dto/response/ProductSummaryResponse';


@Component({
  selector: 'app-product-search-select',
  standalone: true,
  imports: [CommonModule, FormsModule], // Thêm FormsModule
  template: `
    <div class="relative">
      <input type="text"
             [(ngModel)]="searchTerm"
             (ngModelChange)="onSearchTermChange($event)"
             [placeholder]="inputPlaceholder"
             class="input input-bordered input-sm w-full"
             (focus)="showDropdown.set(true)"
             (blur)="onInputBlur()"
             [disabled]="!farmerId"> <!-- Disable nếu chưa có farmerId -->
      <div *ngIf="!farmerId && !initialProduct" class="text-xs text-warning mt-1">
        Vui lòng chọn người bán trước.
      </div>
      <div *ngIf="showDropdown() && (foundProducts().length > 0 || isLoading()) && farmerId"
           class="absolute z-10 w-full bg-base-100 dark:bg-gray-700 shadow-lg rounded-md mt-1 max-h-60 overflow-y-auto border dark:border-gray-600">
        <div *ngIf="isLoading()" class="p-2 text-center text-xs">Đang tìm sản phẩm...</div>
        <ul>
          <li *ngFor="let product of foundProducts()"
              (click)="selectProduct(product)"
              class="px-3 py-2 hover:bg-base-200 dark:hover:bg-gray-600 cursor-pointer text-sm flex items-center gap-2">
            <img [src]="product.thumbnailUrl || 'assets/images/placeholder-image.png'" alt="" class="w-8 h-8 object-cover rounded-sm">
            <div>
              <div class="font-medium">{{ product.name }}</div>
              <div class="text-xs opacity-70">Tồn kho: {{ product.stockQuantity }} {{ product.unit }}</div>
            </div>
          </li>
        </ul>
      </div>
      <div *ngIf="showDropdown() && foundProducts().length === 0 && !isLoading() && searchTerm.length > 1 && farmerId"
           class="absolute z-10 w-full bg-base-100 dark:bg-gray-700 shadow-lg rounded-md mt-1 p-2 text-center text-xs border dark:border-gray-600">
        Không tìm thấy sản phẩm nào của nông dân này.
      </div>
    </div>
  `
})
export class ProductSearchSelectComponent implements OnChanges {
  @Input() farmerId: number | null = null; // Nhận farmerId để lọc sản phẩm
  @Input() initialProduct: { id: number | null, name: string | null } | null = null;
  @Output() productSelected = new EventEmitter<ProductSummaryResponse | null>();

  private productService = inject(ProductService);
  searchTerm = '';
  private searchSubject = new Subject<string>();

  foundProducts = signal<ProductSummaryResponse[]>([]);
  isLoading = signal(false);
  showDropdown = signal(false);
  inputPlaceholder = 'Tìm sản phẩm của nông dân...';

  constructor() {
    this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      filter(term => term.length > 1 || term.length === 0),
      switchMap(term => {
        if (!this.farmerId || term.length === 0) {
          this.foundProducts.set([]);
          return of(null);
        }
        this.isLoading.set(true);
        const params: ProductSearchParams = {
          farmerId: this.farmerId,
          keyword: term,
          page: 0,
          size: 10, // Giới hạn số lượng kết quả gợi ý
          status: 'PUBLISHED', // Chỉ tìm sản phẩm đang bán
          sort: 'name,asc'
        };
        return this.productService.getMySupplyProducts(params).pipe( // Gọi API lấy sản phẩm của farmer
          catchError(() => {
            this.isLoading.set(false);
            this.foundProducts.set([]);
            return of(null);
          })
        );
      })
    ).subscribe(response => {
      this.isLoading.set(false);
      if (response && response.success && response.data) {
        this.foundProducts.set(response.data.content);
      } else {
        this.foundProducts.set([]);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialProduct'] && this.initialProduct?.name) {
      this.searchTerm = this.initialProduct.name;
    }
    if (changes['farmerId']) {
      // Khi farmerId thay đổi (ví dụ admin chọn farmer khác), reset tìm kiếm sản phẩm
      this.searchTerm = '';
      this.foundProducts.set([]);
      this.productSelected.emit(null);
      this.inputPlaceholder = this.farmerId ? 'Tìm sản phẩm của nông dân...' : 'Vui lòng chọn người bán';
    }
  }

  onSearchTermChange(term: string): void {
    this.searchSubject.next(term);
    if (!term) {
      this.productSelected.emit(null);
    }
  }

  selectProduct(product: ProductSummaryResponse): void {
    this.searchTerm = product.name;
    this.productSelected.emit(product);
    this.showDropdown.set(false);
    this.foundProducts.set([]);
  }

  onInputBlur(): void {
    setTimeout(() => this.showDropdown.set(false), 150);
  }
}
