import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router'; // Import ActivatedRoute, Router
import { ProductService, ProductSearchParams } from '../../services/product.service';
import { CategoryService } from '../../services/category.service'; // Import CategoryService
import { ProductSummaryResponse } from '../../dto/response/ProductSummaryResponse';
import { CategoryResponse } from '../../dto/response/CategoryResponse'; // Import CategoryResponse
import {ApiResponse, PagedApiResponse, PageData} from '../../../../core/models/api-response.model';
import { ProductCardComponent } from '../product-card/product-card.component'; // Import ProductCard
import { CategorySidebarComponent } from '../category-sidebar/category-sidebar.component'; // Import Sidebar
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component'; // Import Paginator
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component'; // Import Loading
import { ReactiveFormsModule, FormBuilder } from '@angular/forms'; // Import FormBuilder

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule, // Thêm ReactiveFormsModule
    ProductCardComponent,
    CategorySidebarComponent,
    PaginatorComponent,
    LoadingSpinnerComponent
  ],
  templateUrl: './product-list.component.html',
})
export class ProductListComponent implements OnInit {
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder); // Inject FormBuilder

  products = signal<ProductSummaryResponse[]>([]);
  paginationData = signal<PageData<ProductSummaryResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  currentCategory = signal<CategoryResponse | null>(null); // Lưu thông tin category hiện tại (nếu lọc)

  // Form cho bộ lọc
  filterForm = this.fb.group({
    keyword: [''],
    // Thêm các control khác nếu cần (giá, rating...)
  });

  // Signal cho các tham số tìm kiếm hiện tại
  searchParams = signal<ProductSearchParams>({ page: 0, size: 12, sort: 'createdAt,desc' });

  constructor() {
    // Lắng nghe sự thay đổi của query params và route params để load lại sản phẩm
    effect(() => {
      const params = this.searchParams();
      this.loadProducts(params);
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const categorySlug = params.get('slug');
      if (categorySlug) {
        this.loadCategoryInfo(categorySlug); // Load thông tin category nếu có slug
        // Cập nhật searchParams để lọc theo category này
        this.searchParams.update(current => ({ ...current, categoryId: null, page: 0 })); // Reset categoryId và page trước khi lấy info
      } else {
        this.currentCategory.set(null);
        // Nếu không có slug category, đảm bảo categoryId trong searchParams là null
        this.searchParams.update(current => ({ ...current, categoryId: null, page: 0 }));
      }
    });

    // Lắng nghe queryParams (ví dụ: ?keyword=abc&page=1)
    this.route.queryParamMap.subscribe(queryParams => {
      const keyword = queryParams.get('keyword');
      const page = queryParams.get('page');
      const size = queryParams.get('size');
      const sort = queryParams.get('sort');
      // Cập nhật searchParams từ queryParams
      this.searchParams.update(current => ({
        ...current,
        keyword: keyword ?? current.keyword, // Giữ giá trị cũ nếu queryParam null
        page: page ? +page : 0, // Chuyển sang số, mặc định là 0
        size: size ? +size : current.size,
        sort: sort ?? current.sort
      }));
      // Cập nhật giá trị cho filterForm nếu có keyword
      if(keyword !== null) { // Kiểm tra null thay vì chỉ truthy
        this.filterForm.patchValue({ keyword: keyword }, { emitEvent: false }); // Không trigger valueChanges
      }
    });

    // Lắng nghe thay đổi của filterForm để cập nhật searchParams (trừ lần đầu)
    this.filterForm.valueChanges.subscribe(formValue => {
      this.searchParams.update(current => ({
        ...current,
        keyword: formValue.keyword ?? null,
        page: 0 // Reset về trang đầu khi filter
      }));
      // Cập nhật URL với queryParams mới
      this.updateUrlQueryParams();
    });
  }

  loadCategoryInfo(slug: string): void {
    this.categoryService.getCategoryBySlug(slug).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.currentCategory.set(res.data);
          // Sau khi có categoryId, cập nhật lại searchParams để load product
          this.searchParams.update(current => ({ ...current, categoryId: res.data?.id ?? null, page: 0 }));
        } else {
          this.currentCategory.set(null);
          this.errorMessage.set(`Không tìm thấy danh mục: ${slug}`);
          this.searchParams.update(current => ({ ...current, categoryId: null, page: 0 })); // Vẫn load sản phẩm không lọc category
        }
      },
      error: (err) => {
        this.currentCategory.set(null);
        this.errorMessage.set(`Lỗi khi tải danh mục: ${slug}`);
        this.searchParams.update(current => ({ ...current, categoryId: null, page: 0 }));
      }
    });
  }

  loadProducts(params: ProductSearchParams): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.productService.searchPublicProducts(params).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.products.set(response.data.content);
          this.paginationData.set(response.data);
        } else {
          this.products.set([]);
          this.paginationData.set(null);
          this.errorMessage.set(response.message || 'Không tìm thấy sản phẩm nào.');
        }
        this.isLoading.set(false);
      },
      error: (err: ApiResponse<null>) => {
        this.products.set([]);
        this.paginationData.set(null);
        this.errorMessage.set(err.message || 'Đã xảy ra lỗi khi tải sản phẩm.');
        this.isLoading.set(false);
      }
    });
  }

  // Xử lý sự kiện đổi trang từ PaginatorComponent
  onPageChange(page: number): void {
    this.searchParams.update(current => ({ ...current, page: page }));
    this.updateUrlQueryParams(); // Cập nhật URL
  }

  // Cập nhật Query Params trên URL
  private updateUrlQueryParams(): void {
    const currentParams = this.searchParams();
    const queryParams: ProductSearchParams = {}; // Chỉ đưa các param có giá trị vào URL

    if (currentParams.keyword) queryParams.keyword = currentParams.keyword;
    if (currentParams.page && currentParams.page > 0) queryParams.page = currentParams.page; // Chỉ thêm nếu > 0
    if (currentParams.size !== 12) queryParams.size = currentParams.size; // Chỉ thêm nếu khác default
    if (currentParams.sort !== 'createdAt,desc') queryParams.sort = currentParams.sort; // Chỉ thêm nếu khác default

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'merge', // Giữ lại các query params khác (nếu có)
      replaceUrl: true // Không tạo lịch sử trình duyệt mới khi chỉ thay đổi query params
    });
  }

  // Xử lý submit form filter
  applyFilter(): void {
    // valueChanges đã tự động cập nhật searchParams và URL
    // Hàm này có thể dùng nếu muốn trigger tìm kiếm bằng nút bấm thay vì valueChanges
    const formValue = this.filterForm.value;
    this.searchParams.update(current => ({
      ...current,
      keyword: formValue.keyword ?? null,
      page: 0 // Reset về trang đầu khi filter
    }));
    this.updateUrlQueryParams();
  }

  // Xử lý khi chọn category từ sidebar
  onCategorySelected(categoryId: number | null): void {
    this.currentCategory.set(null); // Reset thông tin category cũ
    this.searchParams.update(current => ({ ...current, categoryId: categoryId, page: 0 }));
    this.updateUrlQueryParams();
    // Nếu muốn hiển thị tên category mới, cần gọi lại API lấy thông tin category đó
  }
  /**
   * Hàm trackBy cho vòng lặp *ngFor của danh sách sản phẩm.
   * Giúp Angular tối ưu việc render lại list khi dữ liệu thay đổi.
   * @param index Index của phần tử trong mảng.
   * @param item Đối tượng ProductSummaryResponse.
   * @returns ID của sản phẩm để Angular theo dõi.
   */
  trackProductById(index: number, item: ProductSummaryResponse): number { // *** THÊM HÀM NÀY ***
    return item.id; // Trả về ID của sản phẩm
  }

}
