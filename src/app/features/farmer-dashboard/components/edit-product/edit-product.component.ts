import {Component, OnInit, inject, signal, OnDestroy, computed, ChangeDetectorRef} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../../../catalog/services/product.service';
import { CategoryService } from '../../../catalog/services/category.service';
import { ProductRequest } from '../../../catalog/dto/request/ProductRequest';
import { ProductDetailResponse } from '../../../catalog/dto/response/ProductDetailResponse';
import { CategoryResponse } from '../../../catalog/dto/response/CategoryResponse';
import { ProductImageRequest } from '../../../catalog/dto/request/ProductImageRequest';

import {getProductStatusText, ProductStatus} from '../../../catalog/domain/product-status.enum';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ToastrService } from 'ngx-toastr';
import {Observable, Subject} from 'rxjs';
import {takeUntil, finalize, distinctUntilChanged, debounceTime} from 'rxjs/operators';

import {ProductImageResponse} from '../../../catalog/dto/response/ProductImageResponse';

import {FileUploadResponse} from '../../../../common/dto/response/FileUploadResponse';
import {CdkDragDrop, DragDropModule, moveItemInArray} from '@angular/cdk/drag-drop';
import {FileUploadComponent} from '../../../../shared/components/file-uploader/file-uploader.component';
// @ts-ignore
import slugify from 'slug';


@Component({
  selector: 'app-edit-product',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LoadingSpinnerComponent, AlertComponent, DecimalPipe, FileUploadComponent, DragDropModule ],
  templateUrl: './edit-product.component.html',
})
export class EditProductComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);


  productForm!: FormGroup;
  isLoading = signal(false); // Loading chung khi submit/load
  isFetchingData = signal(false); // Loading khi lấy dữ liệu ban đầu (edit mode)
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  productId = signal<number | null>(null); // Lưu ID sản phẩm nếu là edit mode
  isEditMode = computed(() => !!this.productId()); // Xác định mode

  categories = signal<CategoryResponse[]>([]); // Danh sách category phẳng
  // Dùng FormArray để quản lý ảnh và bậc giá
  imagesArray!: FormArray;


  // Lấy danh sách trạng thái Farmer có thể chọn
  // availableStatuses = [ProductStatus.DRAFT, ProductStatus.UNPUBLISHED, ProductStatus.PENDING_APPROVAL];

  getStatusText = getProductStatusText;

  ngOnInit(): void {
    this.initForm();
    this.loadCategories();
    this.setupSlugListener();

    // Lấy productId từ route params
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const idParam = params.get('id');
        if (idParam) {
          const id = +idParam;
          if (!isNaN(id)) {
            this.productId.set(id);
            this.loadProductData(id); // Load dữ liệu nếu là edit mode
          } else {
            this.handleErrorAndNavigate('ID sản phẩm không hợp lệ.');
          }
        } else {
          this.productId.set(null); // Chế độ thêm mới
          this.isFetchingData.set(false); // Không cần fetch data
          this.productForm.get('status')?.clearValidators(); // Xóa validator nếu có
          this.productForm.get('status')?.updateValueAndValidity();
          // Không cần patchValue cho status ở đây, sẽ xử lý khi submit
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForm(): void {
    this.imagesArray = this.fb.array([]); // Khởi tạo FormArray rỗng
    // this.pricingTiersArray = this.fb.array([]); // Khởi tạo FormArray rỗng

    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      slug: [''],
      categoryId: [null, Validators.required],
      description: [''],
      unit: ['', [Validators.required, Validators.maxLength(50)]],
      price: [null, [Validators.required, Validators.min(0)]], // Giá B2C
      stockQuantity: [0, [Validators.required, Validators.min(0)]],
      status: [null],

      images: this.imagesArray, // Gán FormArray vào form group

    });

  }


  loadCategories(): void {
    this.categoryService.getAllCategoriesFlat()
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        if (res.success && res.data) {
          this.categories.set(res.data);
        } else {
          this.toastr.warning('Không tải được danh sách danh mục.');
        }
      });
  }

  loadProductData(id: number): void {
    this.isFetchingData.set(true);
    this.errorMessage.set(null);
    this.productService.getMyProductById(id) // Gọi API lấy sản phẩm của farmer
      .pipe(takeUntil(this.destroy$), finalize(() => this.isFetchingData.set(false)))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            const product = res.data;
            this.productForm.patchValue({
              name: product.name,
              categoryId: product.category?.id,
              description: product.description,
              unit: product.unit,
              price: product.price, // Cần xử lý BigDecimal nếu có
              stockQuantity: product.stockQuantity,
              status: product.status,

            });
            // Xóa các ảnh và bậc giá cũ trong FormArray
            this.imagesArray.clear();

            product.images?.forEach(imgResp => this.addImageControl(imgResp));
            this.cdr.markForCheck(); // Cập nhật view
          } else {
            this.handleErrorAndNavigate(res.message || 'Không tìm thấy sản phẩm.');
          }
        },
        error: (err) => {
          this.handleErrorAndNavigate(err.message || 'Lỗi khi tải dữ liệu sản phẩm.');
        }
      });
  }


  availableStatusesForFarmerWhenEditing(): ProductStatus[] {
    // Farmer chỉ có thể chuyển sản phẩm của họ về DRAFT hoặc UNPUBLISHED
    // PENDING_APPROVAL sẽ do hệ thống tự set khi có thay đổi đáng kể trên sản phẩm PUBLISHED
    // hoặc khi tạo mới.
    return [ProductStatus.DRAFT, ProductStatus.UNPUBLISHED];
  }

  // --- Quản lý Ảnh ---
  createImageGroup(imgData?: ProductImageResponse | ProductImageRequest): FormGroup {
    return this.fb.group({
      id: [(imgData && 'id' in imgData) ? imgData.id : null],
      imageUrl: [imgData?.imageUrl || ''], // Dùng imageUrl từ response/request

      blobPath: [(imgData?.blobPath) || null, Validators.required],
      isDefault: [imgData?.isDefault ?? false],
      displayOrder: [imgData?.displayOrder ?? 0, Validators.required]
    });
  }


  addImageControl(imgData?: ProductImageRequest | ProductImageResponse): void {
    const imageGroup = this.createImageGroup(imgData);
    // Nếu là ảnh mới từ upload và chưa có isDefault, set ảnh đầu tiên làm default
    if (!(imgData && 'id' in imgData) && this.imagesArray.length === 0) {
      imageGroup.get('isDefault')?.setValue(true);
    }
    this.imagesArray.push(imageGroup);
    this.updateDisplayOrder(); // Cập nhật thứ tự sau khi thêm
    this.checkAndSetDefaultImage(); // Đảm bảo có default
    // 🔍 Debug sau khi thêm control ảnh
    console.log('Form hợp lệ?', this.productForm.valid);
    console.log('ImagesArray hợp lệ?', this.imagesArray.valid);
    console.log('Lỗi form:', this.productForm.errors);
    console.log('Lỗi từng ảnh:', this.imagesArray.controls.map(c => c.errors));
  }

  removeImageControl(index: number): void {
    const imageControl = this.imagesArray.at(index);
    const imageId = imageControl.get('id')?.value;
    const blobPath = imageControl.get('blobPath')?.value; // Lấy blobPath từ form control


    this.imagesArray.removeAt(index);
    this.updateDisplayOrder();
    this.checkAndSetDefaultImage();
    this.productForm.markAsDirty();
  }

  // Hàm xử lý khi upload thành công từ FileUploadComponent
  onImageUploaded(uploadResponse: FileUploadResponse): void {
    console.log('File uploaded, response from server:', uploadResponse);
    console.log('FileUploadComponent Response:', uploadResponse); // Log toàn bộ response
    console.log('File Download URI:', uploadResponse?.fileDownloadUri); // Log cụ thể URI
    console.log('File Download URI Length:', uploadResponse?.fileDownloadUri?.length);
    const newImageRequest: ProductImageRequest = {

      imageUrl: uploadResponse.fileDownloadUri, // URL để hiển thị
      blobPath: uploadResponse.fileName,
      isDefault: this.imagesArray.length === 0, // Ảnh đầu tiên là default
      displayOrder: this.imagesArray.length    // Thứ tự cuối cùng
    };
    this.addImageControl(newImageRequest);
    this.errorMessage.set(null); // Xóa lỗi cũ nếu có
  }


  onImageUploadError(errorMsg: string): void {
    this.errorMessage.set(`Lỗi tải ảnh: ${errorMsg}`); // Hiển thị lỗi chung của form nếu muốn
    this.toastr.error(`Lỗi tải ảnh: ${errorMsg}`); // Hiển thị toastr lỗi
  }


  setDefaultImage(selectedIndex: number): void {
    this.imagesArray.controls.forEach((control, index) => {
      control.get('isDefault')?.setValue(index === selectedIndex);
    });
    this.imagesArray.markAsDirty(); // Đánh dấu form đã thay đổi
  }

  // Cập nhật lại displayOrder cho tất cả ảnh sau khi kéo thả hoặc xóa
  updateDisplayOrder(): void {
    this.imagesArray.controls.forEach((control, index) => {
      control.get('displayOrder')?.setValue(index, { emitEvent: false }); // Cập nhật không trigger valueChanges
    });
    this.imagesArray.markAsDirty();
  }

  // Đảm bảo luôn có một ảnh default nếu có ảnh
  checkAndSetDefaultImage(): void {
    if (this.imagesArray.length > 0 && !this.imagesArray.controls.some(c => c.get('isDefault')?.value)) {
      this.imagesArray.at(0)?.get('isDefault')?.setValue(true);
      this.imagesArray.markAsDirty();
    }
  }

  sortImagesByOrder(): void {
    this.imagesArray.controls.sort((a, b) =>
      (a.get('displayOrder')?.value ?? 0) - (b.get('displayOrder')?.value ?? 0)
    );
  }

  // Xử lý sự kiện kéo thả ảnh
  dropImage(event: CdkDragDrop<FormGroup[]>) {
    moveItemInArray(this.imagesArray.controls, event.previousIndex, event.currentIndex);
    this.updateDisplayOrder(); // Cập nhật lại thứ tự sau khi thả
  }



  // --- Submit Form ---
  onSubmit(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      // Tìm control đầu tiên bị lỗi và focus (tùy chọn)
      const firstErrorControl = document.querySelector('.ng-invalid[formControlName]');
      if (firstErrorControl instanceof HTMLElement) {
        firstErrorControl.focus();
      }

      this.toastr.error('Vui lòng kiểm tra lại các trường dữ liệu.');
      return;
    }
    // Đảm bảo có ít nhất 1 ảnh nếu là sản phẩm mới? (Tùy yêu cầu)
    if (!this.isEditMode() && this.imagesArray.length === 0) {
      this.toastr.error('Vui lòng thêm ít nhất một hình ảnh cho sản phẩm.');
      return;
    }
    // Đảm bảo có ít nhất 1 ảnh được chọn làm mặc định
    if (this.imagesArray.length > 0 && !this.imagesArray.controls.some(control => control.get('isDefault')?.value === true)) {
      this.toastr.warning('Vui lòng chọn một ảnh làm ảnh đại diện mặc định.');
      // Tự động set ảnh đầu tiên làm default nếu muốn
      // this.imagesArray.at(0)?.get('isDefault')?.setValue(true);
      return;
    }


    this.isLoading.set(true);
    this.errorMessage.set(null);
    // Lấy dữ liệu thô từ form
    const formValue = this.productForm.getRawValue();
    // *** THÊM LOGIC Ở ĐÂY: Gán status mặc định khi thêm mới ***

    // ****** CHUẨN HÓA DỮ LIỆU ẢNH ĐỂ GỬI LÊN BACKEND ******
    const imageRequests: ProductImageRequest[] = this.imagesArray.controls.map((ctrl, index) => {
      const imgValue = ctrl.value;
      return {
        id: imgValue.id || null,
        imageUrl: imgValue.imageUrl,
        blobPath: imgValue.blobPath || null,
        isDefault: imgValue.isDefault,
        displayOrder: index // Luôn cập nhật displayOrder theo vị trí hiện tại
      };
    });




    let finalStatus: ProductStatus; // Khai báo kiểu rõ ràng

    if (this.isEditMode()) {
      // Khi chỉnh sửa, lấy giá trị status từ form (nếu người dùng có thể thay đổi)
      // Hoặc giữ nguyên trạng thái cũ nếu logic không cho phép Farmer thay đổi trực tiếp sang mọi trạng thái
      finalStatus = formValue.status; // Farmer chỉ có thể chọn DRAFT/UNPUBLISHED
                                      // Nếu sản phẩm đang PUBLISHED và có thay đổi, backend/service sẽ tự chuyển sang PENDING
    } else {
      // Khi thêm mới, mặc định là PENDING_APPROVAL
      finalStatus = ProductStatus.PENDING_APPROVAL;
    }
   // const requestData: ProductRequest = this.productForm.getRawValue(); // Lấy cả giá trị disable


    // Tạo request data với trạng thái đã được xử lý
    const requestData: ProductRequest = {
      name: formValue.name,
      categoryId: formValue.categoryId,
      description: formValue.description || null,
      unit: formValue.unit, // Đơn vị B2C
      price: formValue.price, // Giá B2C
      stockQuantity: formValue.stockQuantity,
      status: finalStatus,
      b2bEnabled: false, // << LUÔN SET LÀ FALSE CHO SẢN PHẨM B2C

      images: imageRequests, // Sử dụng mảng đã chuẩn hóa

      // slug sẽ được tạo ở backend
    };

    console.log("Submitting product data:", JSON.stringify(requestData, null, 2));

    let apiCall: Observable<ApiResponse<ProductDetailResponse>>;

    if (this.isEditMode()) {
      apiCall = this.productService.updateMyProduct(this.productId()!, requestData);
    } else {
      apiCall = this.productService.createMyProduct(requestData);
    }

    apiCall.pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const message = this.isEditMode() ? 'Cập nhật sản phẩm thành công!' : 'Thêm sản phẩm thành công! Sản phẩm đang chờ duyệt.';
          this.toastr.success(message);
          // Điều hướng về trang quản lý sản phẩm sau khi lưu
          this.router.navigate(['/farmer/products']);
        } else {
          this.handleError(res, 'Lưu sản phẩm thất bại.');
        }
      },
      error: (err) => this.handleError(err, 'Lỗi khi lưu sản phẩm.')
    });
  }

  setupSlugListener(): void {
    const nameControl = this.productForm.get('name');
    const slugControl = this.productForm.get('slug');
    if (nameControl && slugControl) {
      nameControl.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      ).subscribe(nameValue => {
        if(nameValue && (!slugControl.value || !slugControl.dirty)) {

          const generatedSlug = slugify(nameValue, { lower: true, replacement: '-' });
          slugControl.setValue(generatedSlug, { emitEvent: false });
        }
      });
    }
  }

  // Helper xử lý lỗi và điều hướng
  private handleErrorAndNavigate(message: string): void {
    this.errorMessage.set(message);
    this.toastr.error(message);
    this.isLoading.set(false);
    this.isFetchingData.set(false);
    // Điều hướng về trang quản lý nếu có lỗi nghiêm trọng khi load data
    // this.router.navigate(['/farmer/products']);
  }
  // Helper xử lý lỗi chung
  private handleError(err: any, defaultMessage: string): void {
    const message = err?.message || defaultMessage;
    this.errorMessage.set(message);
    this.toastr.error(message);
    this.isLoading.set(false);
    this.isFetchingData.set(false);
    console.error(err);
  }
  /**
   * Hàm trackBy cho vòng lặp *ngFor của danh sách ảnh.
   * Dùng index vì FormControl trong FormArray không có ID ổn định.
   */
  trackImageByIndex(index: number, item: any): number {
    return index;
  }
}
