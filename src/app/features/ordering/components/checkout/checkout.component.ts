import {Component, OnInit, inject, signal, computed, ChangeDetectorRef, effect} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { UserProfileService } from '../../../user-profile/services/user-profile.service';
import { Address } from '../../../user-profile/domain/address.model';
import { PaymentMethod, getPaymentMethodText } from '../../domain/payment-method.enum';
import { CheckoutRequest } from '../../dto/request/CheckoutRequest';
import { AddressFormComponent } from '../../../user-profile/components/address-form/address-form.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ToastrService } from 'ngx-toastr';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { OrderResponse } from '../../dto/response/OrderResponse';
import {distinctUntilChanged, finalize, takeUntil} from 'rxjs/operators';
import {log} from '@angular-devkit/build-angular/src/builders/ssr-dev-server';
import {FormatBigDecimalPipe} from '../../../../shared/pipes/format-big-decimal.pipe';
import {Observable, of, shareReplay, Subject} from 'rxjs';
import {AuthService} from '../../../../core/services/auth.service';
import {LocationService} from '../../../../core/services/location.service';
import BigDecimal from 'js-big-decimal';
import {OrderType} from '../../domain/order-type.enum';
import {CartItemResponse} from '../../dto/response/CartItemResponse';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AddressFormComponent, LoadingSpinnerComponent, AlertComponent, DecimalPipe, FormatBigDecimalPipe],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent implements OnInit {
  private fb = inject(FormBuilder);
  cartService = inject(CartService); // Để public cho template truy cập cart()
  private orderService = inject(OrderService);
  private userProfileService = inject(UserProfileService);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private authService = inject(AuthService);
  private locationService = inject(LocationService);

  checkoutForm!: FormGroup;
  addresses = signal<Address[]>([]);
  isLoadingAddresses = signal(true);
  isLoadingCheckout = signal(false);
  errorMessage = signal<string | null>(null);
  showNewAddressForm = signal(false);

  // ****** THÊM CACHE CHO TÊN ĐỊA DANH ******
  private locationNameCache = new Map<string, Observable<string | null>>();
  // *****************************************

  // Lấy giỏ hàng hiện tại
  cart = computed(() => this.cartService.getCurrentCart());

  // Lấy danh sách phương thức thanh toán hợp lệ (ví dụ lọc bỏ INVOICE)
  //paymentMethodsok = Object.values(PaymentMethod).filter(m => m !== PaymentMethod.INVOICE);




  // ***********************************************

  getPaymentMethodText = getPaymentMethodText;

  selectedAddressId = signal<number | null>(null); // Signal riêng cho addressId


  isBusinessBuyer = this.authService.hasRoleSignal('ROLE_BUSINESS_BUYER');

  // // Lọc phương thức thanh toán dựa trên vai trò
  // paymentMethods = computed(() => {
  //   const allMethods = Object.values(PaymentMethod);
  //   if (this.isBusinessBuyer()) {
  //     // Cho phép Công nợ và Chuyển khoản cho B2B (Ví dụ)
  //     return allMethods.filter(m => m === PaymentMethod.INVOICE || m === PaymentMethod.BANK_TRANSFER );
  //   } else {
  //     // Bỏ Công nợ cho B2C
  //     return allMethods.filter(m => m !== PaymentMethod.INVOICE);
  //   }
  // });


  // Tính toán tạm thời (cần logic chính xác hơn)
  // TODO: Implement accurate shipping fee calculation
  shippingFee = signal<number>(15000); // Phí ship giả định
  discount = signal<number>(0); // Giảm giá giả định
  totalAmount = computed(() => {
    const subTotal = Number(this.cart()?.subTotal?.toString() ?? '0'); // Chuyển BigDecimal/string sang number
    return subTotal + this.shippingFee() - this.discount();
  });

  // Signals cho tổng tiền tính toán từ API (Cách 1)
  calculatedSubTotal = signal<number | string | BigDecimal>(0);
  calculatedShippingFee = signal<number | string | BigDecimal>(0);
  calculatedDiscount = signal<number | string | BigDecimal>(0);
  calculatedTotalAmount = signal<number | string | BigDecimal>(0);
  isLoadingTotals = signal(false);


  // ****** THÊM SIGNAL LƯU ORDER TYPE TỪ API ******
  orderTypeUsedInCalc = signal<OrderType | null>(null);
  // **********************************************

  // ****** EXPOSE ENUM CHO TEMPLATE ******
  OrderType = OrderType;
  // ************************************

  availablePaymentMethods = computed<PaymentMethod[]>(() => { // <<< THÊM KIỂU TRẢ VỀ <PaymentMethod[]>
    const allMethods = Object.values(PaymentMethod);
    const orderType = this.orderTypeUsedInCalc();

    let allowedMethods: PaymentMethod[];

    if (orderType === OrderType.B2B) {
      // Nếu là đơn hàng B2B, chỉ cho phép thanh toán Công nợ hoặc Chuyển khoản
      allowedMethods = allMethods.filter(
        (m): m is PaymentMethod.INVOICE | PaymentMethod.BANK_TRANSFER =>
          m === PaymentMethod.INVOICE || m === PaymentMethod.BANK_TRANSFER
      );
    } else {
      // Nếu là đơn hàng B2C, cho phép các phương thức bán lẻ
      allowedMethods = allMethods.filter(
        (m): m is Exclude<PaymentMethod, PaymentMethod.INVOICE> =>
          m !== PaymentMethod.INVOICE
      );
    }

    // Loại bỏ MoMo và ZaloPay khỏi danh sách cuối cùng
    return allowedMethods.filter(m => m !== PaymentMethod.MOMO && m !== PaymentMethod.ZALOPAY);
  });


  constructor() {
    // Lắng nghe cart$ để tính lại totals
    this.cartService.cart$
      .pipe(takeUntil(this.destroy$))
      .subscribe(cartData => {
        const selectedAddressId = this.checkoutForm?.get('shippingAddressId')?.value;
        if (this.checkoutForm) {
          if (cartData && cartData.items.length > 0) {
            this.calculateTotals({ shippingAddressId: selectedAddressId });
          } else {
            this.resetCalculatedTotals();
          }
        }
      });
  }


  ngOnInit(): void {
    // Nếu giỏ hàng trống, quay về trang chủ hoặc giỏ hàng
    if (!this.cart() || (this.cart()?.items?.length ?? 0) === 0) {
      this.toastr.warning("Giỏ hàng trống, không thể thanh toán.");
      this.router.navigate(['/cart']);
      return; // Dừng thực thi ngOnInit
    }
    // Quan trọng: Khởi tạo form TRƯỚC khi load địa chỉ
    this.initForm();
    this.loadAddresses(); // Hàm này sẽ patch address và trigger effect ở trên

    // Lắng nghe thay đổi addressId từ form để tính lại totals
    this.checkoutForm.get('shippingAddressId')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged(), // Chỉ trigger khi ID thực sự thay đổi
        // skip(1) // Bỏ qua giá trị null ban đầu nếu không muốn tính toán với null
      )
      .subscribe(addressId => {
        console.log("shippingAddressId changed in form:", addressId);
        // Gọi tính toán khi địa chỉ thay đổi
        this.calculateTotals({ shippingAddressId: addressId });
      });
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  loadInitialTotals(): void {
    const initialAddressId = this.checkoutForm.get('shippingAddressId')?.value;
    this.calculateTotals({ shippingAddressId: initialAddressId });
  }
  // ****** HÀM GỌI API TÍNH TOÁN ******
  calculateTotals(requestData: { shippingAddressId: number | null }): void {
    // Không tính nếu giỏ hàng trống
    if (!this.cart() || (this.cart()?.items?.length ?? 0) === 0) {
      this.resetCalculatedTotals();
      return;
    }

    console.log("Calling calculateTotals API with request:", requestData); // Log để debug

    this.isLoadingTotals.set(true);
    this.errorMessage.set(null); // Xóa lỗi cũ
    this.orderService.calculateTotals(requestData)
      .pipe(
        takeUntil(this.destroy$),
        )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.calculatedSubTotal.set(res.data.subTotal);
            this.calculatedShippingFee.set(res.data.shippingFee);
            this.calculatedDiscount.set(res.data.discountAmount);
            this.calculatedTotalAmount.set(res.data.totalAmount);
            // ****** LƯU ORDER TYPE ******
            this.orderTypeUsedInCalc.set(res.data.calculatedOrderType);
            // Sau khi có orderType, cập nhật lại giá trị mặc định cho paymentMethod nếu cần
            const currentPaymentMethod = this.checkoutForm.get('paymentMethod')?.value;
            const allowedMethods = this.availablePaymentMethods(); // Lấy danh sách phương thức hợp lệ mới

            if (!allowedMethods.includes(currentPaymentMethod)) {
              // Nếu phương thức hiện tại không còn hợp lệ, chọn phương thức đầu tiên trong danh sách mới
              this.checkoutForm.patchValue({ paymentMethod: allowedMethods[0] ?? null }, { emitEvent: false });
            }
          } else {
            this.toastr.error(res.message || 'Lỗi tính toán tổng tiền đơn hàng.');
            this.resetCalculatedTotals(); // Reset về 0 nếu lỗi
          }
          this.isLoadingTotals.set(false); // Tắt loading khi thành công hoặc lỗi API
          this.cdr.markForCheck(); // Đảm bảo UI cập nhật sau khi set signal
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Lỗi kết nối khi tính tổng tiền.');
          this.resetCalculatedTotals();
          this.isLoadingTotals.set(false); // Tắt loading khi lỗi kết nối
          this.cdr.markForCheck();
          this.errorMessage.set(err.error?.message || 'Lỗi kết nối khi tính tổng tiền.'); // Hiển thị lỗi chung
        }
      });
  }

  // Hàm reset giá trị tính toán
  private resetCalculatedTotals(): void {
    this.calculatedSubTotal.set(0);
    this.calculatedShippingFee.set(0);
    this.calculatedDiscount.set(0);
    this.orderTypeUsedInCalc.set(null);
    this.calculatedTotalAmount.set(0);
    this.isLoadingTotals.set(false);
  }
  // ***********************************





  initForm(): void {
    this.checkoutForm = this.fb.group({
      shippingAddressId: [null, Validators.required],
      // Lấy giá trị mặc định từ availablePaymentMethods signal sau khi effect chạy lần đầu
      // Hoặc đặt tạm là null và effect sẽ cập nhật
      paymentMethod: [null, Validators.required],
      notes: ['', Validators.maxLength(500)],
      purchaseOrderNumber: ['', Validators.maxLength(50)] // PO Number chỉ hiển thị cho B2B nhưng control vẫn tồn tại
    });
  }

  loadAddresses(): void {
    this.isLoadingAddresses.set(true);
    this.userProfileService.getMyAddresses().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.addresses.set(res.data);
          const defaultAddress = res.data.find(addr => addr.isDefault);
          // if (defaultAddress) {
          //   this.checkoutForm.patchValue({ shippingAddressId: defaultAddress.id });
          // } else if (res.data.length > 0) {
          //   this.checkoutForm.patchValue({ shippingAddressId: res.data[0].id });
          // } else {
          //   // Nếu không có địa chỉ nào, bắt buộc phải thêm mới
          //   this.showNewAddressForm.set(true);
          //   this.checkoutForm.controls['shippingAddressId'].clearValidators();
          //   this.checkoutForm.controls['shippingAddressId'].updateValueAndValidity();
          // }
          const preselectAddressId = defaultAddress?.id ?? (res.data.length > 0 ? res.data[0].id : null);



          if (preselectAddressId) {
            // Patch value và trigger tính toán ban đầu
            this.checkoutForm.patchValue({ shippingAddressId: preselectAddressId }, { emitEvent: true }); // emitEvent: true để trigger effect
          } else {
            this.showNewAddressForm.set(true);
            this.checkoutForm.controls['shippingAddressId'].clearValidators();
            this.checkoutForm.controls['shippingAddressId'].updateValueAndValidity();
            // Không cần gọi calculateTotals ở đây, effect cart sẽ xử lý hoặc valueChanges sẽ xử lý khi có địa chỉ
            this.resetCalculatedTotals(); // Reset khi không có địa chỉ ban đầu
          }
        } else {
          // Lỗi tải địa chỉ, nhưng có thể cho phép thêm mới
          this.showNewAddressForm.set(true);
          this.checkoutForm.controls['shippingAddressId'].clearValidators();
          this.checkoutForm.controls['shippingAddressId'].updateValueAndValidity();
          this.toastr.warning(res.message || 'Không tải được địa chỉ đã lưu, vui lòng thêm địa chỉ mới.');
          // Gọi calculate với addressId là null
          //this.calculateTotals({ shippingAddressId: null });
        }
        this.isLoadingAddresses.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Lỗi tải danh sách địa chỉ.');
        this.isLoadingAddresses.set(false);
        this.showNewAddressForm.set(true); // Cho phép thêm mới nếu lỗi
        this.checkoutForm.controls['shippingAddressId'].clearValidators();
        this.checkoutForm.controls['shippingAddressId'].updateValueAndValidity();

        //this.calculateTotals({ shippingAddressId: null }); // Vẫn gọi calculate khi lỗi
      }
    });
  }

  toggleNewAddressForm(): void {
    this.showNewAddressForm.update(v => !v);
    const addressControl = this.checkoutForm.controls['shippingAddressId'];
    if (this.showNewAddressForm()) {
      addressControl.clearValidators();
      addressControl.setValue(null); // Bỏ chọn địa chỉ cũ
    } else {
      addressControl.setValidators(Validators.required);
      // Tự động chọn lại địa chỉ mặc định hoặc đầu tiên nếu có
      const defaultAddress = this.addresses().find(addr => addr.isDefault);
      const firstAddress = this.addresses().length > 0 ? this.addresses()[0] : null;
      addressControl.setValue(defaultAddress?.id ?? firstAddress?.id ?? null);
    }
    addressControl.updateValueAndValidity();
  }

  handleNewAddressSaved(newAddress: Address): void {
    this.loadAddresses(); // Tải lại danh sách
    this.checkoutForm.patchValue({ shippingAddressId: newAddress.id });
    this.showNewAddressForm.set(false);
    this.checkoutForm.controls['shippingAddressId'].setValidators(Validators.required);
    this.checkoutForm.controls['shippingAddressId'].updateValueAndValidity();
    this.cdr.detectChanges(); // Cần detectChanges để cập nhật UI ngay lập tức
  }




  onSubmit(): void {
    if (this.checkoutForm.invalid && !this.showNewAddressForm()) {
      this.checkoutForm.markAllAsTouched();
      this.toastr.error("Vui lòng chọn địa chỉ giao hàng và phương thức thanh toán.");
      return;
    }
    if (!this.cart() || (this.cart()?.items?.length ?? 0) === 0) {
      this.toastr.error("Giỏ hàng của bạn đang trống.");
      this.router.navigate(['/cart']);
      return;
    }
    if(this.showNewAddressForm()) {
      this.toastr.warning("Vui lòng lưu địa chỉ mới hoặc hủy bỏ.");
      return;
    }

    this.isLoadingCheckout.set(true);
    this.errorMessage.set(null);

    const formValue = this.checkoutForm.value;

    const requestData: CheckoutRequest = {
      shippingAddressId: formValue.shippingAddressId,
      paymentMethod: formValue.paymentMethod,
      notes: formValue.notes || null,
      purchaseOrderNumber: this.isBusinessBuyer() ? (formValue.purchaseOrderNumber || null) : null
    };

    this.orderService.checkout(requestData)
      .pipe(
        takeUntil(this.destroy$), // Giả sử có destroy$
        finalize(() => this.isLoadingCheckout.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.data && response.data.length > 0) {
            const createdOrders = response.data;
            // Giả sử chúng ta xử lý từng đơn hàng một nếu có nhiều farmer
            // Hoặc nếu bạn đảm bảo checkout chỉ tạo 1 order cho tất cả (ít khả thi với nhiều farmer)
            const firstOrder = createdOrders[0];

            this.cartService.clearCart(); // Xóa giỏ hàng sau khi đặt hàng thành công

          //   if (firstOrder.paymentMethod === PaymentMethod.BANK_TRANSFER) {
          //     this.toastr.success('Đơn hàng đã được tạo. Vui lòng thực hiện chuyển khoản theo hướng dẫn.', 'Đặt hàng thành công');
          //     this.cartService.loadCart().subscribe(); // Làm mới giỏ hàng
          //     this.router.navigate(['/user/orders', firstOrder.id]); // Điều hướng đến chi tiết đơn hàng
          //   } else if (firstOrder.paymentMethod === PaymentMethod.COD) {
          //     this.toastr.success('Đặt hàng thành công! Bạn sẽ thanh toán khi nhận hàng.');
          //     this.cartService.loadCart().subscribe();
          //     this.router.navigate(['/user/orders', firstOrder.id]);
          //   } else { // Trường hợp VNPay, MoMo (cần tạo payment URL)
          //     this.toastr.info('Đơn hàng đã được tạo. Đang chuyển đến trang thanh toán...');
          //     this.createAndRedirectToPaymentGateway(firstOrder.id, firstOrder.paymentMethod);
          //   }
          // } else {
            if (firstOrder.paymentMethod === PaymentMethod.VNPAY) {
              this.toastr.info('Đơn hàng đã được tạo. Đang chuyển đến trang thanh toán VNPAY...', 'Chuyển hướng');
              this.createAndRedirectToPaymentGateway(firstOrder.id, PaymentMethod.VNPAY);
            } else if (firstOrder.paymentMethod === PaymentMethod.COD) {
              this.toastr.success('Đặt hàng thành công! Bạn sẽ thanh toán khi nhận hàng.', 'Thành công');
              this.router.navigate(['/user/orders', firstOrder.id]); // Điều hướng đến chi tiết đơn hàng
            } else if (firstOrder.paymentMethod === PaymentMethod.BANK_TRANSFER) {
              this.toastr.success('Đơn hàng đã được tạo. Vui lòng thực hiện chuyển khoản theo hướng dẫn.', 'Đặt hàng thành công');
              this.router.navigate(['/user/orders', firstOrder.id]);
            } else {
              // Xử lý các phương thức khác nếu có
              this.toastr.success('Đặt hàng thành công!');
              this.router.navigate(['/user/orders', firstOrder.id]);
            }
          } else {
            this.handleError(response, 'Đặt hàng thất bại.');
          }
        },
        // CheckoutComponent.ts -> onSubmit() -> error block
        error: (err) => {
          const apiError = err.error as ApiResponse<null>;
          const message = apiError?.message || 'Đã xảy ra lỗi khi đặt hàng.';
          this.errorMessage.set(message);
          this.toastr.error(message, 'Đặt hàng thất bại', { timeOut: 7000 }); // Tăng thời gian hiển thị toastr
          this.isLoadingCheckout.set(false);
          console.error(err);

          // Nếu lỗi là do sản phẩm không khả dụng (backend đã xóa khỏi giỏ)
          // thì tải lại giỏ hàng ở frontend để cập nhật UI
          if (message.includes('không còn khả dụng')) {
            this.cartService.loadCart().subscribe(() => {
              this.cdr.markForCheck(); // Đảm bảo UI tóm tắt đơn hàng cập nhật
              // Có thể kiểm tra lại nếu giỏ hàng trống thì điều hướng
              if (!this.cart() || (this.cart()?.items?.length ?? 0) === 0) {
                this.toastr.info("Giỏ hàng của bạn hiện đã trống.");
                this.router.navigate(['/cart']);
              }
            });
          }
        }
      });
  }
  // Hàm mới để xử lý redirect cho cổng thanh toán
  private createAndRedirectToPaymentGateway(orderId: number, paymentMethod: PaymentMethod): void {
    this.orderService.createPaymentUrl(orderId, paymentMethod) // Gọi API tạo URL
      .pipe(
        takeUntil(this.destroy$),
        //finalize(() => this.isLoadingCheckout.set(false)) // Tắt loading ở đây
      )
      .subscribe({
        next: (paymentUrlRes) => {
          if (paymentUrlRes.success && paymentUrlRes.data?.paymentUrl) {
            // Chuyển hướng người dùng đến URL của VNPAY
            window.location.href = paymentUrlRes.data.paymentUrl;
          } else {
            this.errorMessage.set(paymentUrlRes.message || 'Không thể tạo URL thanh toán. Vui lòng thử lại.');
            this.toastr.error(paymentUrlRes.message || 'Không thể tạo URL thanh toán. Vui lòng thử lại.', 'Lỗi');
            this.isLoadingCheckout.set(false); // Tắt loading nếu không redirect được
          }
        },
        error: (err) => {
          this.handleCheckoutError(err, 'Lỗi khi tạo URL thanh toán.');
          this.isLoadingCheckout.set(false); // Tắt loading
        }
      });
  }

  // ****** THÊM HÀM getLocationName ******
  getLocationName(type: 'province' | 'district' | 'ward', code: string | null | undefined): Observable<string | null> {
    if (!code || code === 'undefined') {
      return of(null);
    }

    const cacheKey = `${type}_${code}`;
    if (this.locationNameCache.has(cacheKey)) {
      return this.locationNameCache.get(cacheKey)!;
    }

    let name$: Observable<string | null>;
    switch (type) {
      case 'province':
        name$ = this.locationService.findProvinceName(code);
        break;
      case 'district':
        name$ = this.locationService.findDistrictName(code);
        break;
      case 'ward':
        name$ = this.locationService.findWardName(code);
        break;
      default:
        name$ = of(null);
    }
    const cachedName$ = name$.pipe(shareReplay(1));
    this.locationNameCache.set(cacheKey, cachedName$);
    return cachedName$;
  }

  // ****** SAO CHÉP CÁC HÀM HELPER TỪ CartComponent ******
  getDisplayInfo(item: CartItemResponse): { price: BigDecimal | null, unit: string | null } {
    const product = item.product;
    const quantity = item.quantity;
    if (!product) {
      return { price: null, unit: 'N/A' };
    }

    // Sử dụng isBusinessBuyer() signal đã có
    if (this.isBusinessBuyer() && product.b2bEnabled) { // Giả sử tên trường là b2bEnabled
      let finalPrice = product.b2bBasePrice ? new BigDecimal(product.b2bBasePrice.toString()) : null;
      const unit = product.b2bUnit ?? product.unit;

      if (product.pricingTiers && product.pricingTiers.length > 0) {
        const applicableTier = product.pricingTiers
          .filter(tier => quantity >= tier.minQuantity)
          .sort((a, b) => b.minQuantity - a.minQuantity)[0];

        if (applicableTier?.pricePerUnit) {
          finalPrice = new BigDecimal(applicableTier.pricePerUnit.toString());
        }
      }

      if (finalPrice === null) {
        finalPrice = product.price ? new BigDecimal(product.price.toString()) : null;
      }
      return { price: finalPrice, unit: unit };
    } else {
      return { price: product.price ? new BigDecimal(product.price.toString()) : null, unit: product.unit };
    }
  }

  calculateItemTotal(item: CartItemResponse): BigDecimal {
    const displayInfo = this.getDisplayInfo(item);
    if (displayInfo.price !== null && item.quantity > 0) {
      try {
        return displayInfo.price.multiply(new BigDecimal(item.quantity));
      } catch (e) {
        console.error("Error calculating item total for item:", item, e);
        return new BigDecimal(0);
      }
    }
    return new BigDecimal(0);
  }
  // *****************************************************

  // Helper xử lý lỗi checkout chung
  private handleCheckoutError(err: any, defaultMessage: string): void {
    const apiError = err?.error as ApiResponse<null> || err;
    const message = apiError?.message || defaultMessage;
    this.errorMessage.set(message);
    this.toastr.error(message, 'Đặt hàng thất bại', { timeOut: 7000 });
    this.isLoadingCheckout.set(false);
    console.error("Checkout error:", err);

    if (message.includes('không còn khả dụng')) {
      this.cartService.loadCart().subscribe(() => {
        this.cdr.markForCheck();
        if (!this.cart() || (this.cart()?.items?.length ?? 0) === 0) {
          this.toastr.info("Giỏ hàng của bạn hiện đã trống.");
          this.router.navigate(['/cart']);
        }
      });
    }
  }



  // Helper xử lý lỗi
  private handleError(err: any, defaultMessage: string): void {
    const message = err?.message || defaultMessage;
    this.errorMessage.set(message);
    this.toastr.error(message);
    this.isLoadingCheckout.set(false); // Tắt loading checkout
    console.error(err);
  }
}
