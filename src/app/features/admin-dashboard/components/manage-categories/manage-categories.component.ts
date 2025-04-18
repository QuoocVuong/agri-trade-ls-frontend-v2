import { Component, OnInit, inject, signal, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CategoryResponse } from '../../../catalog/dto/response/CategoryResponse';
import { CategoryRequest } from '../../../catalog/dto/request/CategoryRequest';
import { AdminCatalogService } from '../../services/admin-catalog.service';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ToastrService } from 'ngx-toastr';
import {Observable, Subject} from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { SlugifyPipe } from '../../../../shared/pipes/slugify.pipe';
import {CategoryService} from '../../../catalog/services/category.service'; // Import pipe slugify (cần tạo)

@Component({
  selector: 'app-manage-categories',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LoadingSpinnerComponent, AlertComponent, ModalComponent, SlugifyPipe], // Thêm SlugifyPipe
  templateUrl: './manage-categories.component.html',
})
export class ManageCategoriesComponent implements OnInit, OnDestroy {
  private adminCatalogService = inject(AdminCatalogService);
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();
  private categoryService = inject(CategoryService);

  categories = signal<CategoryResponse[]>([]); // Danh sách category dạng cây
  flatCategories = signal<CategoryResponse[]>([]); // Danh sách category phẳng cho dropdown parent
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  showCategoryModal = signal(false);
  isEditMode = signal(false);
  categoryForm!: FormGroup;
  selectedCategoryId = signal<number | null>(null); // ID của category đang sửa
  isSubmitting = signal(false); // Loading khi submit form

  ngOnInit(): void {
    this.initForm();
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForm(): void {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      slug: ['', Validators.maxLength(120)], // Slug có thể tự tạo
      description: [''],
      imageUrl: ['', Validators.maxLength(512)],
      parentId: [null] // Kiểu number hoặc null
    });
  }

  loadCategories(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    // *** Gọi từ categoryService ***
    this.categoryService.getCategoryTree()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.categories.set(res.data);
            this.flatCategories.set(this.flattenCategories(res.data));
          } else {
            this.categories.set([]);
            this.flatCategories.set([]);
            this.errorMessage.set(res.message || 'Không tải được danh mục.');
          }
          this.isLoading.set(false);
        },
        error: (err) => this.handleError(err, 'Lỗi khi tải danh mục.')
      });
  }


  // Hàm đệ quy để tạo danh sách phẳng từ cây category
  flattenCategories(categories: CategoryResponse[], level = 0, prefix = ''): CategoryResponse[] {
    let flatList: CategoryResponse[] = [];
    for (const category of categories) {
      // Tạo tên có thụt lề để hiển thị trong dropdown
      const displayCategory = { ...category, name: prefix + category.name };
      flatList.push(displayCategory);
      if (category.children && category.children.length > 0) {
        flatList = flatList.concat(this.flattenCategories(category.children, level + 1, prefix + '-- '));
      }
    }
    return flatList;
  }


  openAddModal(): void {
    this.isEditMode.set(false);
    this.selectedCategoryId.set(null);
    this.errorMessage.set(null); // Xóa lỗi cũ
    this.initForm(); // Reset form về trạng thái ban đầu
    this.showCategoryModal.set(true);
  }

  openEditModal(category: CategoryResponse): void {
    this.isEditMode.set(true);
    this.selectedCategoryId.set(category.id);
    this.errorMessage.set(null);
    this.categoryForm.patchValue({ // Điền dữ liệu category vào form
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      parentId: category.parentId
    });
    this.showCategoryModal.set(true);
  }

  closeModal(): void {
    this.showCategoryModal.set(false);
    this.selectedCategoryId.set(null); // Reset ID đang sửa
  }

  saveCategory(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const requestData: CategoryRequest = this.categoryForm.value;
    // Backend sẽ tự tạo slug nếu trường slug rỗng

    let apiCall: Observable<ApiResponse<CategoryResponse>>;

    if (this.isEditMode() && this.selectedCategoryId()) {
      // Cập nhật category
      apiCall = this.adminCatalogService.updateCategory(this.selectedCategoryId()!, requestData);
    } else {
      // Thêm category mới
      apiCall = this.adminCatalogService.createCategory(requestData);
    }

    apiCall.pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isSubmitting.set(false))
    ).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const message = this.isEditMode() ? 'Cập nhật danh mục thành công!' : 'Thêm danh mục thành công!';
          this.toastr.success(message);
          this.closeModal();
          this.loadCategories(); // Tải lại danh sách category
        } else {
          this.handleError(res, 'Lưu danh mục thất bại.');
        }
      },
      error: (err) => this.handleError(err, 'Lỗi khi lưu danh mục.')
    });
  }

  deleteCategory(category: CategoryResponse): void {
    if (confirm(`Bạn có chắc chắn muốn xóa danh mục "${category.name}"? \nLƯU Ý: Hành động này có thể thất bại nếu danh mục có chứa sản phẩm hoặc danh mục con.`)) {
      this.isLoading.set(true); // Dùng loading chung
      this.adminCatalogService.deleteCategory(category.id).subscribe({
        next: (res) => {
          if(res.success) {
            this.toastr.success(`Đã xóa danh mục "${category.name}".`);
            this.loadCategories(); // Load lại danh sách
          } else {
            this.handleError(res, 'Lỗi khi xóa danh mục.');
          }
          this.isLoading.set(false);
        },
        error: (err) => {
          this.handleError(err, 'Lỗi khi xóa danh mục.');
          this.isLoading.set(false);
        }
      });
    }
  }

  // Helper xử lý lỗi
  private handleError(err: any, defaultMessage: string): void {
    const message = err?.message || defaultMessage;
    this.errorMessage.set(message); // Hiển thị lỗi trong modal hoặc alert chung
    this.toastr.error(message);
    this.isLoading.set(false); // Tắt loading chung nếu có
    this.isSubmitting.set(false); // Tắt loading submit
    console.error(err);
  }

  trackCategoryById(index: number, item: CategoryResponse): number {
    return item.id;
  }
  // Hàm helper để tìm tên category cha từ ID
  getParentCategoryName(parentId: number | null): string {
    if (parentId === null) {
      return '-'; // Hoặc 'Danh mục gốc'
    }
    // Tìm trong danh sách phẳng đã có
    const parent = this.flatCategories().find(cat => cat.id === parentId);
    return parent ? parent.name : `ID: ${parentId}`; // Trả về tên hoặc ID nếu không tìm thấy tên
  }
}
