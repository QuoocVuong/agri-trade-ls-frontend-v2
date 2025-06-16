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
import {CategoryService} from '../../../catalog/services/category.service';
import {FileUploadComponent} from '../../../../shared/components/file-uploader/file-uploader.component';
import {FileUploadResponse} from '../../../../common/dto/response/FileUploadResponse';
import {ConfirmationService} from '../../../../shared/services/confirmation.service'; // Import pipe slugify (cần tạo)

@Component({
  selector: 'app-manage-categories',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LoadingSpinnerComponent, AlertComponent, ModalComponent, SlugifyPipe, FileUploadComponent ], // Thêm SlugifyPipe
  templateUrl: './manage-categories.component.html',
})
export class ManageCategoriesComponent implements OnInit, OnDestroy {
  private adminCatalogService = inject(AdminCatalogService);
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();
  private categoryService = inject(CategoryService);
  private confirmationService = inject(ConfirmationService);

  categories = signal<CategoryResponse[]>([]); // Danh sách category dạng cây
  flatCategories = signal<CategoryResponse[]>([]); // Danh sách category phẳng cho dropdown parent
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  showCategoryModal = signal(false);
  isEditMode = signal(false);
  categoryForm!: FormGroup;
  selectedCategoryId = signal<number | null>(null); // ID của category đang sửa
  isSubmitting = signal(false); // Loading khi submit form

  // Lưu blobPath cũ khi edit để xử lý xóa file cũ nếu cần
  private oldBlobPath: string | null | undefined = null;

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
      // imageUrl: ['', Validators.maxLength(512)], // <<< Bỏ imageUrl trực tiếp
      parentId: [null],
      // Thêm controls ẩn để lưu kết quả upload
      blobPath: [null],
      previewImageUrl: [null] // Lưu URL tạm thời để hiển thị preview
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
    this.oldBlobPath = null; // Reset blobPath cũ
    this.initForm(); // Reset form về trạng thái ban đầu
    this.showCategoryModal.set(true);
  }

  openEditModal(category: CategoryResponse): void {
    this.isEditMode.set(true);
    this.selectedCategoryId.set(category.id);
    this.errorMessage.set(null);
    this.oldBlobPath = category.blobPath; // Lưu blobPath cũ
    this.categoryForm.patchValue({ // Điền dữ liệu category vào form
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      parentId: category.parentId,
      blobPath: category.blobPath, // Điền blobPath hiện tại
      previewImageUrl: category.imageUrl // Điền imageUrl (Signed URL) để hiển thị preview ban đầu
    });
    this.showCategoryModal.set(true);
  }

  // Xử lý khi upload ảnh thành công
  onImageUploaded(response: FileUploadResponse): void {
    this.categoryForm.patchValue({
      blobPath: response.fileName, // Lưu blobPath (fileName)
      previewImageUrl: response.fileDownloadUri // Lưu Signed URL để preview
    });
    this.categoryForm.markAsDirty(); // Đánh dấu form đã thay đổi
    this.errorMessage.set(null); // Xóa lỗi cũ nếu có
  }



  // Xử lý khi upload lỗi
  onImageUploadError(errorMsg: string): void {
    this.errorMessage.set(`Lỗi tải ảnh: ${errorMsg}`);
    this.toastr.error(`Lỗi tải ảnh: ${errorMsg}`);
  }

  // Xóa ảnh đã chọn/upload
  removeImage(): void {
    this.categoryForm.patchValue({
      blobPath: null,
      previewImageUrl: null
    });
    this.categoryForm.markAsDirty();
    // Lưu ý: Việc xóa file vật lý trên storage sẽ được xử lý ở backend khi lưu
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

    // Lấy dữ liệu từ form, bao gồm cả blobPath và previewImageUrl
    const formValue = this.categoryForm.value;

    const requestData: CategoryRequest = {
      name: formValue.name,
      slug: formValue.slug,
      description: formValue.description,
      parentId: formValue.parentId,
      blobPath: formValue.blobPath, // <<< Gửi blobPath
      imageUrl: formValue.previewImageUrl // <<< Gửi URL preview (Signed URL)
    };


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
          // Không cần xóa file cũ ở đây, backend đã xử lý trong updateCategory
        } else {
          this.handleError(res, 'Lưu danh mục thất bại.');
        }
      },
      error: (err) => this.handleError(err, 'Lỗi khi lưu danh mục.')
    });
  }

// ... trong class ManageCategoriesComponent ...

  deleteCategory(category: CategoryResponse): void {
    this.confirmationService.open({
      title: 'Xác Nhận Xóa Danh Mục',
      message: `Bạn có chắc chắn muốn xóa danh mục "${category.name}"?\nLƯU Ý: Hành động này có thể thất bại nếu danh mục có chứa sản phẩm hoặc danh mục con.`,
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      confirmButtonClass: 'btn-error',
      iconClass: 'fas fa-trash-alt',
      iconColorClass: 'text-error'
    }).subscribe(confirmed => {
      if (confirmed) {
        this.isLoading.set(true); // Dùng loading chung
        this.adminCatalogService.deleteCategory(category.id).subscribe({
          next: (res) => {
            if(res.success) {
              this.toastr.success(`Đã xóa danh mục "${category.name}".`);
              this.loadCategories(); // Load lại danh sách
            } else {
              // handleError đã có toastr, không cần gọi lại ở đây
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
      // Nếu `confirmed` là false, không làm gì cả.
    });
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
