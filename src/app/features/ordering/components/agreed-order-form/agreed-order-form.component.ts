// src/app/features/ordering/components/agreed-order-form/agreed-order-form.component.ts
import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime, switchMap, filter, tap } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

import { OrderService } from '../../services/order.service';
import { AuthService } from '../../../../core/services/auth.service';

import { ProductService } from '../../../catalog/services/product.service'; // Để tìm sản phẩm của farmer

import { AgreedOrderRequest } from '../../dto/request/AgreedOrderRequest';
import { UserResponse } from '../../../user-profile/dto/response/UserResponse'; // DTO cho tìm kiếm user
import { ProductSummaryResponse } from '../../../catalog/dto/response/ProductSummaryResponse'; // DTO cho tìm sản phẩm
import { PaymentMethod, getPaymentMethodText } from '../../domain/payment-method.enum';

import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';
import { LocationService, Province, District, Ward } from '../../../../core/services/location.service';
import {UserSearchSelectComponent} from '../../../../shared/components/user-search-select/user-search-select.component';
import {
  ProductSearchSelectComponent
} from '../../../../shared/components/product-search-select/product-search-select.component';
import {AgreedOrderItemRequest} from '../../dto/request/AgreedOrderItemRequest';
import {UserProfileService} from '../../../user-profile/services/user-profile.service';



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
    UserSearchSelectComponent, // Thêm component
    ProductSearchSelectComponent // Thêm component
  ],
  templateUrl: './agreed-order-form.component.html',
  // styleUrls: ['./agreed-order-form.component.css']
})
export class AgreedOrderFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private userProfileService = inject(UserProfileService);
  private productService = inject(ProductService); // Service để tìm sản phẩm của farmer
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private locationService = inject(LocationService);
  private destroy$ = new Subject<void>();

  agreedOrderForm!: FormGroup;
  isSubmitting = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  currentUser = this.authService.currentUser;
   isFarmer = this.authService.hasRoleSignal('ROLE_FARMER');
  // isAdmin = this.authService.hasRoleSignal('ROLE_ADMIN');

  // Danh sách cho dropdown
  paymentMethods = Object.values(PaymentMethod).filter(
    // Lọc bỏ các phương thức không phù hợp cho đơn hàng thỏa thuận (ví dụ: VNPAY, MOMO nếu không xử lý URL)
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
      // // Admin có thể cần 1 ô tìm kiếm farmer nếu isFarmer() là false và isAdmin() là true

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

    // if ( this.isFarmer()  && this.currentUser()) {
    //   this.agreedOrderForm.get('farmerId')?.disable(); // Farmer không được sửa farmerId
    // }
  }

  ngOnInit(): void {
    this.loadInitialLocations();
    this.setupLocationCascades();

    // Nếu là farmer, tự điền farmerId
    const currentUserId = this.currentUser()?.id;

    if (this.isFarmer() && currentUserId !== undefined) { // Kiểm tra undefined
      // Nếu bạn có control 'farmerId' trong form:
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
    return this.fb.group({
      productId: [item?.productId || null, Validators.required],
      productDisplay: [{value: item?.productName || '', disabled: true}], // Để hiển thị tên sản phẩm đã chọn
      productName: [item?.productName || '', Validators.required], // Cho phép sửa tên
      unit: [item?.unit || '', Validators.required],
      quantity: [item?.quantity || 1, [Validators.required, Validators.min(1)]],
      pricePerUnit: [item?.pricePerUnit || '', [Validators.required, Validators.min(0.01)]]
    });
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
    if (user && user.id) {
      // Tự động điền thông tin giao hàng từ địa chỉ mặc định của người mua (nếu có)
      // Cần thêm API lấy địa chỉ mặc định của user trong UserService
      this.userProfileService.getDefaultAddress(user.id) // Giả sử có hàm này
        .pipe(takeUntil(this.destroy$))
        .subscribe(address => {
          if (address && address.success && address.data) {
            this.agreedOrderForm.patchValue({
              shippingFullName: address.data.fullName,
              shippingPhoneNumber: address.data.phoneNumber,
              shippingAddressDetail: address.data.addressDetail,
              shippingProvinceCode: address.data.provinceCode,
              // Cần load lại district và ward sau khi patch provinceCode
            });
            // Trigger value change cho provinceCode để load district
            this.agreedOrderForm.get('shippingProvinceCode')?.updateValueAndValidity();
            // Sau đó, khi district được load, có thể patch districtCode và wardCode
            // Hoặc bạn có thể làm logic này phức tạp hơn để tự động chọn.
          }
        });
    }
  }

  onProductSelected(product: ProductSummaryResponse | null, itemIndex: number): void {
    const itemGroup = this.itemsFormArray.at(itemIndex) as FormGroup;
    if (product) {
      itemGroup.patchValue({
        productId: product.id,
        productDisplay: product.name,
        productName: product.name,
        unit: product.wholesaleUnit || product.unit,
        pricePerUnit: product.referenceWholesalePrice || product.price // Ưu tiên giá sỉ tham khảo
      });
    } else {
      itemGroup.patchValue({
        productId: null,
        productDisplay: '',
        productName: '',
        unit: '',
        pricePerUnit: ''
      });
    }
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
        pricePerUnit: item.pricePerUnit.toString() // Đảm bảo là string
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
            this.router.navigate(['/user/orders', res.data.id]); // Hoặc /farmer/orders
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
}
