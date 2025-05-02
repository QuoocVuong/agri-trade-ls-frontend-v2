import { Component, OnInit, inject, signal, OnDestroy, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../../../catalog/services/product.service';
import { CategoryService } from '../../../catalog/services/category.service';
import { ProductRequest } from '../../../catalog/dto/request/ProductRequest';
import { ProductDetailResponse } from '../../../catalog/dto/response/ProductDetailResponse';
import { CategoryResponse } from '../../../catalog/dto/response/CategoryResponse';
import { ProductImageRequest } from '../../../catalog/dto/request/ProductImageRequest';
import { ProductPricingTierRequest } from '../../../catalog/dto/request/ProductPricingTierRequest';
import {getProductStatusText, ProductStatus} from '../../../catalog/domain/product-status.enum';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ToastrService } from 'ngx-toastr';
import {Observable, Subject} from 'rxjs';
import {takeUntil, finalize, filter, switchMap, distinctUntilChanged, debounceTime} from 'rxjs/operators';
import  BigDecimal  from 'js-big-decimal';
import {ProductImageResponse} from '../../../catalog/dto/response/ProductImageResponse';
import {ProductPricingTierResponse} from '../../../catalog/dto/response/ProductPricingTierResponse';
import {FileUploadResponse} from '../../../../common/dto/response/FileUploadResponse';
import {CdkDragDrop, DragDropModule, moveItemInArray} from '@angular/cdk/drag-drop';
import {FileUploadComponent} from '../../../../shared/components/file-uploader/file-uploader.component'; // Import nếu dùng
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


  productForm!: FormGroup;
  isLoading = signal(false); // Loading chung khi submit/load
  isFetchingData = signal(false); // Loading khi lấy dữ liệu ban đầu (edit mode)
  errorMessage = signal<string | null>(null);
  productId = signal<number | null>(null); // Lưu ID sản phẩm nếu là edit mode
  isEditMode = computed(() => !!this.productId()); // Xác định mode

  categories = signal<CategoryResponse[]>([]); // Danh sách category phẳng
  // Dùng FormArray để quản lý ảnh và bậc giá
  imagesArray!: FormArray;
  pricingTiersArray!: FormArray;

  // Lấy danh sách trạng thái Farmer có thể chọn
  availableStatuses = [ProductStatus.DRAFT, ProductStatus.UNPUBLISHED, ProductStatus.PENDING_APPROVAL];

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
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForm(): void {
    this.imagesArray = this.fb.array([]); // Khởi tạo FormArray rỗng
    this.pricingTiersArray = this.fb.array([]); // Khởi tạo FormArray rỗng

    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      slug: [''],
      categoryId: [null, Validators.required],
      description: [''],
      unit: ['', [Validators.required, Validators.maxLength(50)]],
      price: [null, [Validators.required, Validators.min(0)]], // Giá B2C
      stockQuantity: [0, [Validators.required, Validators.min(0)]],
      status: [null, Validators.required], // Mặc định DRAFT
      b2bEnabled: [false],
      b2bUnit: [{ value: '', disabled: true }, Validators.maxLength(50)], // Khởi tạo disable
      minB2bQuantity: [{ value: 1, disabled: true }, Validators.min(1)], // Khởi tạo disable
      b2bBasePrice: [{ value: null, disabled: true }, Validators.min(0)], // Khởi tạo disable
      images: this.imagesArray, // Gán FormArray vào form group
      pricingTiers: this.fb.array([]) // Khởi tạo pricingTiers là FormArray rỗng, cũng disable ban đầu
    });
    this.pricingTiersArray = this.productForm.get('pricingTiers') as FormArray;


  //   // Disable các trường B2B nếu b2bEnabled là false
  //   this.productForm.get('b2bEnabled')?.valueChanges
  //     .pipe(takeUntil(this.destroy$))
  //     .subscribe(isAvailable => {
  //       const b2bControls = ['b2bUnit', 'minB2bQuantity', 'b2bBasePrice', 'pricingTiers'];
  //       if (isAvailable) {
  //         b2bControls.forEach(controlName => this.productForm.get(controlName)?.enable());
  //         // Có thể thêm Validators.required cho b2bUnit, minB2bQuantity nếu cần
  //         this.productForm.get('b2bUnit')?.setValidators([Validators.required, Validators.maxLength(50)]);
  //         this.productForm.get('minB2bQuantity')?.setValidators([Validators.required, Validators.min(1)]);
  //       } else {
  //         b2bControls.forEach(controlName => this.productForm.get(controlName)?.disable());
  //         this.productForm.get('b2bUnit')?.clearValidators();
  //         this.productForm.get('minB2bQuantity')?.clearValidators();
  //         // Xóa giá trị các trường B2B khi disable (tùy chọn)
  //         // this.productForm.patchValue({ b2bUnit: null, minB2bQuantity: null, b2bBasePrice: null });
  //         // this.pricingTiersArray.clear();
  //       }
  //       b2bControls.forEach(controlName => this.productForm.get(controlName)?.updateValueAndValidity());
  //     });
  // }

    // Lắng nghe thay đổi của b2bEnabled
    this.productForm.get('b2bEnabled')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(isAvailable => {
        this.toggleB2BControls(isAvailable); // Gọi hàm helper
      });

    // ****** GỌI HÀM TOGGLE NGAY SAU KHI KHỞI TẠO ******
    // Để đảm bảo trạng thái disable/enable đúng với giá trị ban đầu (false)
    this.toggleB2BControls(this.productForm.get('b2bEnabled')?.value);
    // **************************************************
  }
  // ****** TÁCH LOGIC ENABLE/DISABLE RA HÀM RIÊNG ******
  toggleB2BControls(isAvailable: boolean): void {
    const b2bControls = ['b2bUnit', 'minB2bQuantity', 'b2bBasePrice'];
    if (isAvailable) {
      b2bControls.forEach(controlName => this.productForm.get(controlName)?.enable());
      this.pricingTiersArray.enable(); // Enable cả FormArray
      // Thêm Validators.required
      this.productForm.get('b2bUnit')?.setValidators([Validators.required, Validators.maxLength(50)]);
      this.productForm.get('minB2bQuantity')?.setValidators([Validators.required, Validators.min(1)]);
      this.productForm.get('b2bBasePrice')?.setValidators([Validators.required, Validators.min(0)]); // Thêm required cho giá B2B cơ bản
    } else {
      b2bControls.forEach(controlName => this.productForm.get(controlName)?.disable());
      this.pricingTiersArray.disable(); // Disable cả FormArray
      // Xóa Validators.required
      this.productForm.get('b2bUnit')?.clearValidators();
      this.productForm.get('minB2bQuantity')?.clearValidators();
      this.productForm.get('b2bBasePrice')?.clearValidators();
      // Reset giá trị khi disable (quan trọng)
      this.productForm.patchValue({ b2bUnit: null, minB2bQuantity: 1, b2bBasePrice: null }, { emitEvent: false });
      this.pricingTiersArray.clear(); // Xóa các bậc giá
    }
    // Cập nhật trạng thái validation
    b2bControls.forEach(controlName => this.productForm.get(controlName)?.updateValueAndValidity());
    this.pricingTiersArray.updateValueAndValidity();
  }
  // ****************************************************


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
              b2bEnabled : product.b2bEnabled ,
              b2bUnit: product.b2bUnit,
              minB2bQuantity: product.minB2bQuantity,
              b2bBasePrice: product.b2bBasePrice // Cần xử lý BigDecimal nếu có
            });
            // Xóa các ảnh và bậc giá cũ trong FormArray
            this.imagesArray.clear();
            this.pricingTiersArray.clear();
            // Thêm ảnh vào FormArray
            product.images?.forEach(img => this.addImageControl(img));
            // Thêm bậc giá vào FormArray
            product.pricingTiers?.forEach(tier => this.addPricingTierControl(tier));
            // Trigger valueChanges cho b2bEnabled để disable/enable đúng
            this.productForm.get('b2bEnabled')?.updateValueAndValidity();
          } else {
            this.handleErrorAndNavigate(res.message || 'Không tìm thấy sản phẩm.');
          }
        },
        error: (err) => {
          this.handleErrorAndNavigate(err.message || 'Lỗi khi tải dữ liệu sản phẩm.');
        }
      });
  }

  // --- Quản lý Ảnh ---
  createImageGroup(img?: ProductImageResponse | ProductImageRequest): FormGroup {
    return this.fb.group({
      id: [img?.id || null],
      // imageUrl không cần required ở form nữa vì sẽ lấy từ upload
      imageUrl: [img?.imageUrl || '', Validators.maxLength(512)],
      isDefault: [img?.isDefault || false],
      displayOrder: [img?.displayOrder || 0, Validators.required]
    });
  }


  addImageControl(img?: ProductImageResponse | ProductImageRequest): void {
    let displayOrderValue: number;
    let imageUrlValue: string = ''; // Khởi tạo giá trị mặc định
    let isDefaultValue: boolean = false;
    let idValue: number | null = null;

    // Lấy giá trị từ img nếu nó tồn tại
    if (img) {
      // Ưu tiên displayOrder từ img nếu nó hợp lệ (không phải null/undefined và không phải 0 nếu đã có)
      displayOrderValue = (img.displayOrder !== null && img.displayOrder !== undefined && img.displayOrder !== 0)
        ? img.displayOrder
        : this.imagesArray.length; // Gán thứ tự cuối nếu không có hoặc là 0

      imageUrlValue = img.imageUrl || ''; // Lấy imageUrl hoặc rỗng
      isDefaultValue = img.isDefault ?? false; // Lấy isDefault hoặc false
      // Chỉ lấy id nếu nó tồn tại trong img (thường là từ ProductImageResponse)
      if ('id' in img && img.id !== null && img.id !== undefined) {
        idValue = img.id;
      }
    } else {
      // Nếu không có img đầu vào (ví dụ: gọi từ nút "Thêm URL ảnh")
      displayOrderValue = this.imagesArray.length;
      isDefaultValue = this.imagesArray.length === 0; // Ảnh đầu tiên là default
    }

    // Tạo FormGroup với các giá trị đã xác định
    const imageGroup = this.fb.group({
      id: [idValue],
      imageUrl: [imageUrlValue, [Validators.required, Validators.maxLength(512)]], // Vẫn cần required ở đây
      isDefault: [isDefaultValue],
      displayOrder: [displayOrderValue, Validators.required]
    });

    this.imagesArray.push(imageGroup);
    // Không cần sort ở đây nữa, sẽ sort khi drop hoặc submit
  }

  removeImageControl(index: number): void {
    // TODO: Có thể cần gọi API xóa file vật lý nếu ảnh này đã được lưu trước đó
    // const imageIdToRemove = this.imagesArray.at(index).value.id;
    // const imageUrlToRemove = this.imagesArray.at(index).value.imageUrl;
    // if (imageIdToRemove) { ... gọi API xóa file ... }
    this.imagesArray.removeAt(index);
    this.updateDisplayOrder(); // Cập nhật lại thứ tự sau khi xóa
    this.checkAndSetDefaultImage(); // Đảm bảo luôn có ảnh default
  }

  // Hàm xử lý khi upload thành công từ FileUploadComponent
  onImageUploaded(fileResponse: FileUploadResponse): void {
    const newImageRequest: ProductImageRequest = {
      imageUrl: fileResponse.fileDownloadUri, // Sử dụng URL trả về
      isDefault: this.imagesArray.length === 0,
      displayOrder: this.imagesArray.length
    };
    this.addImageControl(newImageRequest);
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


  // --- Quản lý Bậc giá B2B ---
  createPricingTierGroup(tier?: ProductPricingTierResponse | ProductPricingTierRequest): FormGroup {
    return this.fb.group({
      minQuantity: [tier?.minQuantity || 1, [Validators.required, Validators.min(1)]],
      pricePerUnit: [tier?.pricePerUnit || null, [Validators.required, Validators.min(0)]]
    });
  }

  addPricingTierControl(tier?: ProductPricingTierResponse | ProductPricingTierRequest): void {
    const tierGroup = this.createPricingTierGroup(tier);
    if (!this.productForm.controls['b2bEnabled'].value) {
      tierGroup.disable(); // Disable nếu B2B không được chọn
    }
    this.pricingTiersArray.push(tierGroup);
  }


  removePricingTierControl(index: number): void {
    this.pricingTiersArray.removeAt(index);
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
    let finalStatus = formValue.status;
    if (!this.isEditMode() && finalStatus === null) {
      finalStatus = ProductStatus.PENDING_APPROVAL; // Gán trạng thái chờ duyệt
    }

   // const requestData: ProductRequest = this.productForm.getRawValue(); // Lấy cả giá trị disable


    // Tạo request data với trạng thái đã được xử lý
    const requestData: ProductRequest = {
      ...formValue, // Spread các giá trị khác từ form
      status: finalStatus // Sử dụng trạng thái đã được xử lý
    };

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
    const slugControl = this.productForm.get('slug'); // Giả sử bạn có FormControl cho slug

    if (nameControl && slugControl) {
      nameControl.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      ).subscribe(nameValue => {
        if(nameValue && (!slugControl.value || !slugControl.dirty)) {
          // *** Sử dụng slugify từ thư viện 'slug' ***
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
  trackImageByIndex(index: number, item: any): number { // *** THÊM HÀM NÀY ***
    return index;
  }
}
