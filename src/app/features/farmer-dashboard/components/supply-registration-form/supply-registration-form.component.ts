// src/app/features/catalog/components/supply-registration-form/supply-registration-form.component.ts
import { Component, OnInit, inject, signal, OnDestroy, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {Observable, Subject} from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';


import { ApiResponse } from '../../../../core/models/api-response.model';

import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { FileUploadComponent } from '../../../../shared/components/file-uploader/file-uploader.component';
import { FileUploadResponse } from '../../../../common/dto/response/FileUploadResponse';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
// @ts-ignore
import slugify from 'slug';
import {ProductService} from '../../../catalog/services/product.service';
import {CategoryService} from '../../../catalog/services/category.service';
import {CategoryResponse} from '../../../catalog/dto/response/CategoryResponse';
import {ProductImageRequest} from '../../../catalog/dto/request/ProductImageRequest';
import {ProductImageResponse} from '../../../catalog/dto/response/ProductImageResponse';
import {ProductRequest} from '../../../catalog/dto/request/ProductRequest';
import BigDecimal from 'js-big-decimal';
import {ProductStatus} from '../../../catalog/domain/product-status.enum';
import {ProductDetailResponse} from '../../../catalog/dto/response/ProductDetailResponse';
import {getMassUnitText, MassUnit} from '../../../catalog/domain/mass-unit.enum';

@Component({
  selector: 'app-supply-registration-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    LoadingSpinnerComponent,
    AlertComponent,
    DatePipe,
    FileUploadComponent,
    DragDropModule
  ],
  templateUrl: './supply-registration-form.component.html',
  // styleUrls: ['./supply-registration-form.component.css']
})
export class SupplyRegistrationFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);

  supplyForm!: FormGroup;
  isLoading = signal(false);
  isFetchingInitialData = signal(false); // Cho edit mode (nếu có)
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Giả sử đây là form để Farmer đăng/sửa nguồn cung của họ
  // productId sẽ có giá trị nếu là chỉnh sửa một nguồn cung đã đăng (Product ID)
  productId = signal<number | null>(null);
  isEditMode = computed(() => !!this.productId());

  categories = signal<CategoryResponse[]>([]);
  imagesArray!: FormArray;

  // Danh sách đơn vị cho Farmer chọn
  availableWholesaleUnits = Object.values(MassUnit);
  getUnitText = getMassUnitText; // Để dùng trong template

  constructor() {
    this.imagesArray = this.fb.array([], Validators.required); // Yêu cầu ít nhất 1 ảnh

    this.supplyForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      categoryId: [null, Validators.required],
      description: ['', Validators.maxLength(2000)], // Tăng giới hạn mô tả
      // Các trường B2C cũ có thể bỏ hoặc thay đổi ý nghĩa
      // unit: [''], // Bỏ nếu dùng wholesaleUnit
      // price: [null],


      stockQuantity: [null, [Validators.required, Validators.min(0)]], // Số lượng tồn kho
      harvestDate: [null as string | null], // Ngày thu hoạch
      negotiablePrice: [true], // Mặc định giá có thể thương lượng
      wholesaleUnit: ['', [Validators.required]], // Đơn vị tính sỉ (tấn, tạ, kg)
      referenceWholesalePrice: [null as number | null, [Validators.min(0)]], // Giá sỉ tham khảo

      images: this.imagesArray,
      // Không cần các trường B2B phức tạp như pricingTiers ở đây
      // Trạng thái sẽ do backend xử lý khi tạo mới (PENDING_APPROVAL)
    });
  }

  ngOnInit(): void {
    this.loadCategories();

    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const idParam = params.get('productId'); // Lấy productId nếu là edit
        if (idParam) {
          const id = +idParam;
          if (!isNaN(id)) {
            this.productId.set(id);
            this.loadSupplyDataForEdit(id);
          } else {
            this.toastr.error('ID nguồn cung không hợp lệ.');
            this.router.navigate(['/farmer/dashboard']); // Hoặc trang quản lý nguồn cung
          }
        } else {
          this.productId.set(null); // Chế độ thêm mới
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCategories(): void {
    this.categoryService.getAllCategoriesFlat() // Lấy danh sách phẳng
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        if (res.success && res.data) {
          this.categories.set(res.data);
        } else {
          this.toastr.warning('Không tải được danh sách danh mục.');
        }
      });
  }

  loadSupplyDataForEdit(id: number): void {
    this.isFetchingInitialData.set(true);
    this.productService.getMyProductById(id) // Dùng API lấy sản phẩm của farmer
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isFetchingInitialData.set(false)))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            const product = res.data;
            this.supplyForm.patchValue({
              name: product.name,
              categoryId: product.category?.id,
              description: product.description,
              stockQuantity: product.stockQuantity,
              harvestDate: product.harvestDate,
              negotiablePrice: product.negotiablePrice,
              wholesaleUnit: product.wholesaleUnit, // Ưu tiên wholesaleUnit
              referenceWholesalePrice: product.referenceWholesalePrice
            });
            this.imagesArray.clear();
            product.images?.forEach(img => this.addImageControl(img));
            this.cdr.markForCheck();
          } else {
            this.toastr.error(res.message || 'Không tìm thấy thông tin nguồn cung.');
            this.router.navigate(['/farmer/my-supplies']); // Trang quản lý nguồn cung
          }
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Lỗi khi tải dữ liệu nguồn cung.');
          this.router.navigate(['/farmer/my-supplies']);
        }
      });
  }

  // --- Quản lý Ảnh (Tương tự EditProductComponent) ---
  createImageGroup(imgData?: ProductImageRequest | ProductImageResponse): FormGroup {
    return this.fb.group({
      id: [(imgData && 'id' in imgData) ? imgData.id : null],
      imageUrl: [imgData?.imageUrl || ''],
      blobPath: [imgData?.blobPath || null, Validators.required],
      isDefault: [imgData?.isDefault ?? false],
      displayOrder: [imgData?.displayOrder ?? 0, Validators.required]
    });
  }

  addImageControl(imgData: ProductImageRequest | ProductImageResponse): void {
    const imageGroup = this.createImageGroup(imgData);
    if (!('id' in imgData) && this.imagesArray.length === 0) { // Ảnh mới và là ảnh đầu tiên
      imageGroup.get('isDefault')?.setValue(true);
    }
    this.imagesArray.push(imageGroup);
    this.updateDisplayOrder();
    this.checkAndSetDefaultImage();
  }

  removeImageControl(index: number): void {
    this.imagesArray.removeAt(index);
    this.updateDisplayOrder();
    this.checkAndSetDefaultImage();
    this.supplyForm.markAsDirty();
  }

  onImageUploaded(uploadResponse: FileUploadResponse): void {
    const newImageRequest: ProductImageRequest = {
      imageUrl: uploadResponse.fileDownloadUri,
      blobPath: uploadResponse.fileName,
      isDefault: this.imagesArray.length === 0,
      displayOrder: this.imagesArray.length
    };
    this.addImageControl(newImageRequest);
  }

  onImageUploadError(errorMsg: string): void {
    this.toastr.error(`Lỗi tải ảnh: ${errorMsg}`);
  }

  setDefaultImage(selectedIndex: number): void {
    this.imagesArray.controls.forEach((control, index) => {
      control.get('isDefault')?.setValue(index === selectedIndex);
    });
    this.imagesArray.markAsDirty();
  }

  updateDisplayOrder(): void {
    this.imagesArray.controls.forEach((control, index) => {
      control.get('displayOrder')?.setValue(index, { emitEvent: false });
    });
    this.imagesArray.markAsDirty();
  }

  checkAndSetDefaultImage(): void {
    if (this.imagesArray.length > 0 && !this.imagesArray.controls.some(c => c.get('isDefault')?.value)) {
      this.imagesArray.at(0)?.get('isDefault')?.setValue(true);
      this.imagesArray.markAsDirty();
    }
  }

  dropImage(event: CdkDragDrop<FormGroup[]>) {
    moveItemInArray(this.imagesArray.controls, event.previousIndex, event.currentIndex);
    this.updateDisplayOrder();
  }

  trackImageByIndex(index: number, item: any): number {
    return index;
  }
  // --- Kết thúc Quản lý Ảnh ---

  onSubmit(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.supplyForm.invalid) {
      this.supplyForm.markAllAsTouched();
      this.toastr.error('Vui lòng kiểm tra lại các thông tin đã nhập.');
      return;
    }
    if (this.imagesArray.length === 0) {
      this.toastr.error('Vui lòng thêm ít nhất một hình ảnh cho nguồn cung.');
      return;
    }
    if (!this.imagesArray.controls.some(control => control.get('isDefault')?.value === true)) {
      this.toastr.warning('Vui lòng chọn một ảnh làm ảnh đại diện mặc định.');
      return;
    }

    this.isLoading.set(true);
    const formValue = this.supplyForm.getRawValue();

    const imageRequests: ProductImageRequest[] = this.imagesArray.controls.map((ctrl, index) => {
      const imgValue = ctrl.value;
      return {
        id: imgValue.id || null,
        imageUrl: imgValue.imageUrl,
        blobPath: imgValue.blobPath,
        isDefault: imgValue.isDefault,
        displayOrder: index
      };
    });

    // Tạo ProductRequest từ formValue, tập trung vào các trường của nguồn cung
    const requestData: ProductRequest = {
      name: formValue.name,
      categoryId: formValue.categoryId,
      description: formValue.description || null,
      stockQuantity: formValue.stockQuantity,
      images: imageRequests,

      // Các trường mới cho nguồn cung
      harvestDate: formValue.harvestDate || null, // Ngày thu hoạch
      negotiablePrice: formValue.negotiablePrice,// giá thương lượng
      wholesaleUnit: formValue.wholesaleUnit,// đơn vị bán sll
      referenceWholesalePrice: formValue.referenceWholesalePrice,//giá tham khảo của đơn vị bán sll

      // Các trường B2C cũ có thể đặt giá trị mặc định hoặc null
      unit: formValue.wholesaleUnit || 'đơn vị', // Lấy tạm wholesaleUnit làm unit chính
      price: formValue.referenceWholesalePrice || new BigDecimal(0), // Giá bán lẻ có thể là giá tham khảo sỉ

      // Các trường B2B phức tạp có thể bỏ qua hoặc set mặc định
      b2bEnabled: true, // Mặc định là true cho nguồn cung


      status: ProductStatus.PENDING_APPROVAL, // Luôn gửi duyệt khi tạo/sửa nguồn cung
      // slug sẽ được tạo ở backend
    };

    console.log("Submitting supply data:", JSON.stringify(requestData, null, 2));

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
          const message = this.isEditMode() ? 'Cập nhật nguồn cung thành công!' : 'Đăng nguồn cung thành công! Nguồn cung đang chờ duyệt.';
          this.toastr.success(message);
          this.router.navigate(['/farmer/my-supplies']); // Điều hướng về trang quản lý nguồn cung
        } else {
          this.errorMessage.set(res.message || 'Lưu thông tin thất bại.');
          this.toastr.error(res.message || 'Lưu thông tin thất bại.');
        }
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Đã có lỗi xảy ra.');
        this.toastr.error(err.error?.message || 'Đã có lỗi xảy ra.');
      }
    });
  }
}
