
import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  AbstractControl,
  ValidationErrors, ValidatorFn
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {startWith, Subject} from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

import { OrderService } from '../../../ordering/services/order.service';
import { AuthService } from '../../../../core/services/auth.service';

import { ProductService } from '../../../catalog/services/product.service';

import { AgreedOrderRequest } from '../../../ordering/dto/request/AgreedOrderRequest';
import { UserResponse } from '../../../user-profile/dto/response/UserResponse';
import { ProductSummaryResponse } from '../../../catalog/dto/response/ProductSummaryResponse';
import { PaymentMethod, getPaymentMethodText } from '../../../ordering/domain/payment-method.enum';

import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';
import { LocationService, Province, District, Ward } from '../../../../core/services/location.service';
import {UserSearchSelectComponent} from '../../../../shared/components/user-search-select/user-search-select.component';
import {
  ProductSearchSelectComponent
} from '../../../../shared/components/product-search-select/product-search-select.component';
import {AgreedOrderItemRequest} from '../../../ordering/dto/request/AgreedOrderItemRequest';
import {UserProfileService} from '../../../user-profile/services/user-profile.service';
import BigDecimal from 'js-big-decimal';



@Component({
  selector: 'app-agreed-order-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    LoadingSpinnerComponent,
    AlertComponent,
    FormatBigDecimalPipe,
    DatePipe,
    UserSearchSelectComponent,
    ProductSearchSelectComponent
  ],
  templateUrl: './agreed-order-form.component.html',

})
export class AgreedOrderFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private userProfileService = inject(UserProfileService);
  private productService = inject(ProductService);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private locationService = inject(LocationService);
  private destroy$ = new Subject<void>();
  private selectedProductsInfo = new Map<number, { stockQuantity: number, unit: string }>();

  agreedOrderForm!: FormGroup;
  isSubmitting = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  currentUser = this.authService.currentUser;
   isFarmer = this.authService.hasRoleSignal('ROLE_FARMER');


  // Danh sách cho dropdown
  paymentMethods = Object.values(PaymentMethod).filter(

    method => method === PaymentMethod.BANK_TRANSFER || method === PaymentMethod.INVOICE || method === PaymentMethod.COD
  );
  getPaymentMethodText = getPaymentMethodText;

  provinces = signal<Province[]>([]);
  districts = signal<District[]>([]);
  wards = signal<Ward[]>([]);

  // Signals cho tìm kiếm người mua và sản phẩm
  foundBuyers = signal<UserResponse[]>([]);
  isSearchingBuyer = signal(false);
  selectedBuyer = signal<UserResponse | null>(null);

  foundProducts = signal<ProductSummaryResponse[]>([]);
  isSearchingProduct = signal(false);


  constructor() {

    const currentUserId = this.currentUser()?.id;

    this.agreedOrderForm = this.fb.group({
      buyerId: [null as number | null, Validators.required], // Sẽ được set khi chọn người mua
      buyerDisplay: [{ value: '', disabled: true }], // Chỉ để hiển thị tên người mua
      farmerId: [{ value: currentUserId !== undefined ? currentUserId : null, disabled: true }],


      items: this.fb.array([this.createItemFormGroup()], Validators.required),

      agreedTotalAmount: ['', [Validators.required, Validators.min(0.01)]],
      agreedPaymentMethod: [PaymentMethod.BANK_TRANSFER, Validators.required],

      shippingFullName: ['', Validators.maxLength(100)],
      shippingPhoneNumber: ['', [Validators.pattern(/^(\+84|0)\d{9,10}$/)]],
      shippingAddressDetail: ['', Validators.maxLength(255)],
      shippingProvinceCode: [''],
      shippingDistrictCode: [''],
      shippingWardCode: [''],

      notes: ['', Validators.maxLength(1000)],
      expectedDeliveryDate: ['']
    });


  }

  ngOnInit(): void {
    this.loadInitialLocations();
    this.setupLocationCascades();

    this.subscribeToItemChangesToCalculateTotal();

    // Nếu là farmer, tự điền farmerId
    const currentUserId = this.currentUser()?.id;

    if (this.isFarmer() && currentUserId !== undefined) { // Kiểm tra undefined

      this.agreedOrderForm.patchValue({ farmerId: currentUserId });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get itemsFormArray(): FormArray {
    return this.agreedOrderForm.get('items') as FormArray;
  }

  createItemFormGroup(item?: AgreedOrderItemRequest): FormGroup {
    const group =  this.fb.group({
      productId: [item?.productId || null, Validators.required],
      productDisplay: [{value: item?.productName || '', disabled: true}], // Để hiển thị tên sản phẩm đã chọn
      productName: [item?.productName || '', Validators.required], // Cho phép sửa tên
      unit: [item?.unit || '', Validators.required],
      quantity: [item?.quantity || 1, [Validators.required, Validators.min(1)]],
      pricePerUnit: [item?.pricePerUnit || '', [Validators.required, Validators.min(0.01)]]
    });
    // Thêm validator động cho 'quantity'
    group.get('quantity')?.setValidators([
      Validators.required,
      Validators.min(1),
      this.maxQuantityValidator(group) // Truyền vào cả form group của item
    ]);

    return group;
  }


  private maxQuantityValidator(itemGroup: FormGroup): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const productId = itemGroup.get('productId')?.value;
      if (!productId) {
        return null; // Bỏ qua nếu chưa chọn sản phẩm
      }

      const productInfo = this.selectedProductsInfo.get(productId);
      if (!productInfo) {
        return null; // Bỏ qua nếu không có thông tin tồn kho
      }

      const maxQuantity = productInfo.stockQuantity;
      const enteredQuantity = control.value;

      if (enteredQuantity > maxQuantity) {
        return { maxQuantityExceeded: { max: maxQuantity, actual: enteredQuantity } };
      }

      return null;
    };
  }


  addItem(): void {
    this.itemsFormArray.push(this.createItemFormGroup());
  }

  removeItem(index: number): void {
    if (this.itemsFormArray.length > 1) {
      this.itemsFormArray.removeAt(index);
    } else {
      this.toastr.warning('Đơn hàng phải có ít nhất một sản phẩm.');
    }
  }

  loadInitialLocations(): void {
    this.locationService.getProvinces().subscribe(p => this.provinces.set(p));
  }

  setupLocationCascades(): void {
    this.agreedOrderForm.get('shippingProvinceCode')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(provinceCode => {
        this.agreedOrderForm.get('shippingDistrictCode')?.setValue('');
        this.agreedOrderForm.get('shippingWardCode')?.setValue('');
        this.districts.set([]);
        this.wards.set([]);
        if (provinceCode) {
          this.locationService.getDistricts(provinceCode).subscribe(d => this.districts.set(d));
        }
      });

    this.agreedOrderForm.get('shippingDistrictCode')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(districtCode => {
        this.agreedOrderForm.get('shippingWardCode')?.setValue('');
        this.wards.set([]);
        if (districtCode) {
          this.locationService.getWards(districtCode).subscribe(w => this.wards.set(w));
        }
      });
  }

  onBuyerSelected(user: UserResponse | null): void {
    this.selectedBuyer.set(user);
    this.agreedOrderForm.patchValue({
      buyerId: user?.id || null,
      buyerDisplay: user?.fullName || ''
    });

    // Reset các trường địa chỉ trước khi điền mới
    this.agreedOrderForm.patchValue({
      shippingFullName: '',
      shippingPhoneNumber: '',
      shippingAddressDetail: '',
      shippingProvinceCode: '',
      shippingDistrictCode: '',
      shippingWardCode: ''
    });
    this.districts.set([]);
    this.wards.set([]);

    if (user && user.id) {
      this.userProfileService.getDefaultAddress(user.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(addressRes => {
          if (addressRes.success && addressRes.data) {
            const address = addressRes.data;

            // Điền các thông tin text trước
            this.agreedOrderForm.patchValue({
              shippingFullName: address.fullName,
              shippingPhoneNumber: address.phoneNumber,
              shippingAddressDetail: address.addressDetail,
            });

            // *** BẮT ĐẦU CHUỖI XỬ LÝ BẤT ĐỒNG BỘ CHO ĐỊA CHỈ ***
            if (address.provinceCode) {
              // 1. Gán giá trị cho Tỉnh
              this.agreedOrderForm.get('shippingProvinceCode')?.setValue(address.provinceCode);

              // 2. Sau khi gán, gọi API lấy danh sách Huyện
              this.locationService.getDistricts(address.provinceCode).subscribe(districts => {
                this.districts.set(districts);

                // 3. Sau khi có danh sách Huyện, gán giá trị cho Huyện
                if (address.districtCode && districts.some(d => d.idDistrict === address.districtCode)) {
                  this.agreedOrderForm.get('shippingDistrictCode')?.setValue(address.districtCode);

                  // 4. Sau khi gán Huyện, gọi API lấy danh sách Xã
                  this.locationService.getWards(address.districtCode).subscribe(wards => {
                    this.wards.set(wards);

                    // 5. Sau khi có danh sách Xã, gán giá trị cho Xã
                    if (address.wardCode && wards.some(w => w.idWard === address.wardCode)) {
                      this.agreedOrderForm.get('shippingWardCode')?.setValue(address.wardCode);
                    }
                  });
                }
              });
            }
          } else {
            // Nếu không có địa chỉ mặc định, có thể điền tên và sđt của user
            this.agreedOrderForm.patchValue({
              shippingFullName: user.fullName,
              shippingPhoneNumber: user.phoneNumber
            });
          }
        });
    }
  }

  onProductSelected(product: ProductSummaryResponse | null, itemIndex: number): void {
    const itemGroup = this.itemsFormArray.at(itemIndex) as FormGroup;
    if (product) {

      // *** LƯU LẠI THÔNG TIN TỒN KHO ***
      this.selectedProductsInfo.set(product.id, {
        stockQuantity: product.stockQuantity,
        unit: product.unit
      });


      itemGroup.patchValue({
        productId: product.id,
        productDisplay: product.name,
        productName: product.name,
        unit: product.wholesaleUnit || product.unit,
        pricePerUnit: product.referenceWholesalePrice || product.price // Ưu tiên giá sỉ tham khảo
      });

      // Cập nhật lại validator cho ô số lượng sau khi đã có thông tin tồn kho
      itemGroup.get('quantity')?.updateValueAndValidity();

    } else {
      const oldProductId = itemGroup.get('productId')?.value;
      if (oldProductId) {
        this.selectedProductsInfo.delete(oldProductId);
      }
      itemGroup.patchValue({
        productId: null,
        productDisplay: '',
        productName: '',
        unit: '',
        pricePerUnit: ''
      });
      itemGroup.get('quantity')?.updateValueAndValidity();
    }
  }

  getProductStockInfo(itemIndex: number): { stockQuantity: number, unit: string } | undefined {
    const itemGroup = this.itemsFormArray.at(itemIndex) as FormGroup;
    const productId = itemGroup.get('productId')?.value;
    if (productId) {
      return this.selectedProductsInfo.get(productId);
    }
    return undefined;
  }


  onSubmit(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    if (this.agreedOrderForm.invalid) {
      this.agreedOrderForm.markAllAsTouched();
      this.toastr.error('Vui lòng kiểm tra lại các thông tin đã nhập.');
      return;
    }

    this.isSubmitting.set(true);
    const formValue = this.agreedOrderForm.getRawValue(); // getRawValue để lấy cả trường disabled (farmerId)
    const farmerIdFromForm = formValue.farmerId;
    const actualFarmerId: number | null = farmerIdFromForm !== undefined ? farmerIdFromForm : null;

    const request: AgreedOrderRequest = {
      buyerId: formValue.buyerId!,
      //farmerId: formValue.farmerId!,
      items: formValue.items.map((item: any) => ({
        productId: item.productId,
        productName: item.productName,
        unit: item.unit,
        quantity: +item.quantity,
        pricePerUnit: item.pricePerUnit.toString()
      })),
      agreedTotalAmount: formValue.agreedTotalAmount.toString(),
      agreedPaymentMethod: formValue.agreedPaymentMethod!,
      shippingFullName: formValue.shippingFullName || null,
      shippingPhoneNumber: formValue.shippingPhoneNumber || null,
      shippingAddressDetail: formValue.shippingAddressDetail || null,
      shippingProvinceCode: formValue.shippingProvinceCode || null,
      shippingDistrictCode: formValue.shippingDistrictCode || null,
      shippingWardCode: formValue.shippingWardCode || null,
      notes: formValue.notes || null,
      expectedDeliveryDate: formValue.expectedDeliveryDate || null
    };

    this.orderService.createAgreedOrder(request)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isSubmitting.set(false))
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.toastr.success('Đơn hàng thỏa thuận đã được tạo thành công!');
            this.successMessage.set(`Đã tạo đơn hàng #${res.data.orderCode}.`);
            this.agreedOrderForm.reset({
              farmerId: this.isFarmer() ? this.currentUser()?.id : null,
              agreedPaymentMethod: PaymentMethod.BANK_TRANSFER
            });
            this.itemsFormArray.clear();
            this.addItem(); // Thêm lại một item rỗng
            this.selectedBuyer.set(null);
            // Điều hướng đến chi tiết đơn hàng vừa tạo
            this.router.navigate(['/user/orders', res.data.id]);
          } else {
            this.errorMessage.set(res.message || 'Tạo đơn hàng thất bại.');
            this.toastr.error(res.message || 'Tạo đơn hàng thất bại.');
          }
        },
        error: (err) => {
          this.errorMessage.set(err.error?.message || 'Đã có lỗi xảy ra.');
          this.toastr.error(err.error?.message || 'Đã có lỗi xảy ra.');
        }
      });
  }


  subscribeToItemChangesToCalculateTotal(): void {
    this.itemsFormArray.valueChanges.pipe(
      startWith(this.itemsFormArray.value), // Kích hoạt lần đầu ngay lập tức để tính toán giá trị ban đầu
      takeUntil(this.destroy$)
    ).subscribe(items => {
      let total = new BigDecimal(0);
      if (items && Array.isArray(items)) {
        items.forEach(item => {
          const qty = item.quantity;
          const price = item.pricePerUnit;
          // Chỉ tính toán nếu cả số lượng và giá đều hợp lệ và lớn hơn 0
          if (qty && price && +qty > 0 && +price > 0) {
            try {
              total = total.add(new BigDecimal(qty).multiply(new BigDecimal(price)));
            } catch (e) {
              console.error("Lỗi khi tính toán tổng tiền cho item:", item, e);
            }
          }
        });
      }
      // Cập nhật giá trị cho form control 'agreedTotalAmount'
      // Dùng emitEvent: false để tránh gây ra vòng lặp nếu có logic khác lắng nghe valueChanges của cả form
      this.agreedOrderForm.get('agreedTotalAmount')?.setValue(total.getValue(), { emitEvent: false });
    });
  }
}
