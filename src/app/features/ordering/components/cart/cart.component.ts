import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  computed,
  OnDestroy, OnInit
} from '@angular/core'; // Thêm ChangeDetection
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { CartResponse } from '../../dto/response/CartResponse';
import { CartItemResponse } from '../../dto/response/CartItemResponse';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { CartItemUpdateRequest } from '../../dto/request/CartItemUpdateRequest';
import { Observable, Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { NgxSpinnerService } from 'ngx-spinner';
import { ToastrService } from 'ngx-toastr';
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';
import {ApiResponse} from '../../../../core/models/api-response.model';
import {AuthService} from '../../../../core/services/auth.service';
import BigDecimal from 'js-big-decimal';
import {CartAdjustmentInfo} from '../../dto/response/CartAdjustmentInfo';
import {CartValidationResponse} from '../../dto/response/CartValidationResponse';
import { ConfirmationService } from '../../../../shared/services/confirmation.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingSpinnerComponent, AlertComponent, FormatBigDecimalPipe ],
  templateUrl: './cart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush // Tối ưu change detection
})
export class CartComponent implements OnInit, OnDestroy {
  cartService = inject(CartService);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef);
  spinner = inject(NgxSpinnerService);
  toastr = inject(ToastrService);
  authService = inject(AuthService);
  private confirmationService = inject(ConfirmationService);

  cart$: Observable<CartResponse | null> = this.cartService.cart$;

  // Lấy cart$ từ service và chuyển thành signal để dễ dùng hơn
  private cartDataSource = signal<CartResponse | null>(null);
  cart = computed(() => this.cartDataSource()); // Signal cart chính

  isLoading = this.cartService.isLoading;
  // Dùng Map để quản lý loading cho từng item hiệu quả hơn signal lồng
  itemLoadingMap = new Map<number, boolean>();
  clearLoading = signal(false);
  errorMessage = signal<string | null>(null);

  private destroy$ = new Subject<void>(); // Subject để unsubscribe

  // Signal xác định vai trò user
  isBusinessBuyer = this.authService.hasRoleSignal('ROLE_BUSINESS_BUYER');

  constructor() {
    // Lắng nghe cart$ từ service để cập nhật signal nội bộ
    this.cartService.cart$
      .pipe(takeUntil(this.destroy$))
      .subscribe(cartData => {
        this.cartDataSource.set(cartData);
        this.cdr.markForCheck(); // Cần thiết khi dùng OnPush
      });
  }




  ngOnInit(): void {
    this.cartService.cart$
      .pipe(takeUntil(this.destroy$))
      .subscribe(cartData => {
        this.cartDataSource.set(cartData);
        if (cartData && cartData.adjustments && cartData.adjustments.length > 0) {
          // Hiển thị thông báo nếu getCart trả về adjustments
          this.displayCartAdjustments(cartData.adjustments, "Thông tin giỏ hàng");

        }
        this.cdr.markForCheck();
      });

    if (!this.cartService.getCurrentCart()) {
      this.cartService.loadCart().subscribe();
    }
  }

  // Hàm mới để hiển thị thông báo điều chỉnh
  private displayCartAdjustments(adjustments: CartAdjustmentInfo[], titlePrefix: string = "Giỏ hàng đã cập nhật"): void {
    adjustments.forEach(adj => {
      if (adj.type === 'REMOVED') {
        this.toastr.warning(adj.message, titlePrefix, { timeOut: 7000, closeButton: true});
      } else if (adj.type === 'ADJUSTED') {
        this.toastr.info(adj.message, titlePrefix, { timeOut: 7000, closeButton: true });
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  getDisplayInfo(item: CartItemResponse): { price: BigDecimal | null, unit: string | null } {
    const product = item.product;
    const quantity = item.quantity;
    if (!product) {
      return { price: null, unit: 'N/A' };
    }

    if (this.isBusinessBuyer() && product.b2bEnabled) {
      let finalPrice = product.b2bBasePrice ? new BigDecimal(product.b2bBasePrice.toString()) : null;
      const unit = product.b2bUnit ?? product.unit; // Ưu tiên đơn vị B2B

      // Xử lý bậc giá
      if (product.pricingTiers && product.pricingTiers.length > 0) {
        // Tìm bậc giá cao nhất mà số lượng hiện tại đạt được
        const applicableTier = product.pricingTiers
          .filter(tier => quantity >= tier.minQuantity) // Lọc các bậc đạt đủ số lượng
          .sort((a, b) => b.minQuantity - a.minQuantity)[0]; // Sắp xếp giảm dần và lấy bậc đầu tiên (cao nhất)

        if (applicableTier?.pricePerUnit) {
          finalPrice = new BigDecimal(applicableTier.pricePerUnit.toString());
        }
      }


      if (finalPrice === null) {
        finalPrice = product.price ? new BigDecimal(product.price.toString()) : null;
      }

      return { price: finalPrice, unit: unit };

    } else {
      // Trường hợp B2C
      return { price: product.price ? new BigDecimal(product.price.toString()) : null, unit: product.unit };
    }
  }


  // ****** HÀM HELPER TÍNH LẠI ITEM TOTAL ******
  calculateItemTotal(item: CartItemResponse): BigDecimal {
    const displayInfo = this.getDisplayInfo(item);
    if (displayInfo.price !== null && item.quantity > 0) {
      try {
        // price đã là BigDecimal từ getDisplayInfo
        return displayInfo.price.multiply(new BigDecimal(item.quantity));
      } catch (e) {
        console.error("Error calculating item total for item:", item, e);
        return new BigDecimal(0);
      }

    }
    return new BigDecimal(0);
  }

  // ****** COMPUTED SIGNAL TÍNH LẠI SUB TOTAL ******
  calculatedSubTotal = computed(() => {
    const currentCart = this.cart();
    if (!currentCart || !currentCart.items) {
      return new BigDecimal(0);
    }
    return currentCart.items.reduce((sum, item) => {
      return sum.add(this.calculateItemTotal(item));
    }, new BigDecimal(0));
  });


  updateQuantity(item: CartItemResponse, newQuantityInput: number | string): void {
    // Chuyển đổi và kiểm tra giá trị nhập
    let newQuantity = typeof newQuantityInput === 'string' ? parseInt(newQuantityInput, 10) : newQuantityInput;

    if (isNaN(newQuantity) || !item.product || this.isItemLoading(item.id)) {
      // Nếu giá trị nhập không phải số, hoặc không có product, hoặc đang loading thì không làm gì
      // Hoặc reset về giá trị cũ nếu muốn
      const inputElement = document.getElementById(`quantity-input-${item.id}`) as HTMLInputElement | null;
      if(inputElement) inputElement.value = item.quantity.toString();
      return;
    }


    const minQuantity = (this.isBusinessBuyer() && item.product.b2bEnabled)
      ? (item.product.minB2bQuantity || 1)
      : 1;
    if (newQuantity < minQuantity) {
      this.toastr.warning(`Số lượng tối thiểu cho sản phẩm này là ${minQuantity}.`);
      newQuantity = minQuantity; // Set về mức tối thiểu
      // Cập nhật lại input nếu cần
      const inputElement = document.getElementById(`quantity-input-${item.id}`) as HTMLInputElement | null;
      if(inputElement) inputElement.value = newQuantity.toString();
      // Không return vội, vẫn gọi API với số lượng min
    }




    const availableStock = item.product.stockQuantity ?? 0;
    const oldQuantity = item.quantity;
    const productName = item.product.name ?? 'Sản phẩm';


    if (newQuantity > availableStock) {
      this.toastr.error(`Chỉ còn ${availableStock} ${item.product.name} trong kho.`);
      // Set lại giá trị input về mức tối đa
      const inputElement = document.getElementById(`quantity-input-${item.id}`) as HTMLInputElement | null;
      if(inputElement) inputElement.value = availableStock.toString();
      // Không gọi API nếu số lượng yêu cầu đã vượt quá tồn kho
      return;
    }

    // Nếu số lượng không thay đổi thì không cần gọi API
    if (newQuantity === oldQuantity) {
      return;
    }

    this.setItemLoading(item.id, true);
    this.errorMessage.set(null);
    const request: CartItemUpdateRequest = { quantity: newQuantity };

    this.cartService.updateItemQuantity(item.id, request)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.setItemLoading(item.id, false))
      )
      .subscribe({
        // next: thành công, CartService sẽ tự cập nhật cart$
        next: (response) => {
          // Kiểm tra lại sau khi API thành công (Backend nên trả về số lượng tồn mới nhất)
          const updatedItemData = response.data; // Giả sử API trả về CartItemResponse mới
          const finalQuantity = updatedItemData?.quantity ?? newQuantity;
          const finalStock = updatedItemData?.product?.stockQuantity ?? availableStock;
          if (finalQuantity === finalStock) {
            this.toastr.info(`Đã đạt số lượng tối đa (${finalStock}) cho "${productName}".`);
          }
        },
        error: (err) => this.handleError(err, 'Lỗi cập nhật số lượng.', item.id, oldQuantity) // Truyền thêm oldQuantity
      });
  }

  removeItem(itemId: number): void {
    if (this.isItemLoading(itemId)) return;

    this.setItemLoading(itemId, true);
    this.errorMessage.set(null);
    this.cartService.removeItem(itemId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.setItemLoading(itemId, false))
      )
      .subscribe({
        next: () => this.toastr.success('Đã xóa sản phẩm khỏi giỏ hàng.'),
        error: (err) => this.handleError(err, 'Lỗi xóa sản phẩm.')
      });
  }

  clearCart(): void {
    this.confirmationService.open({
      title: 'Xác Nhận Xóa Giỏ Hàng',
      message: 'Bạn có chắc chắn muốn xóa toàn bộ sản phẩm khỏi giỏ hàng không? Hành động này không thể hoàn tác.',
      confirmText: 'Xóa Hết',
      cancelText: 'Hủy',
      confirmButtonClass: 'btn-error', // Dùng màu đỏ cho hành động nguy hiểm
      iconClass: 'fas fa-trash-alt', // Icon thùng rác
      iconColorClass: 'text-error'
    }).subscribe(confirmed => {
      if (confirmed) {
        this.clearLoading.set(true);
        this.errorMessage.set(null);
        this.cartService.clearCart()
          .pipe(
            takeUntil(this.destroy$),
            finalize(() => this.clearLoading.set(false))
          )
          .subscribe({
            next: () => this.toastr.success('Đã xóa toàn bộ giỏ hàng.'),
            error: (err) => this.handleError(err, 'Lỗi khi xóa giỏ hàng.')
          });
      }
      // Nếu `confirmed` là false, không làm gì cả.
    });

  }

  goToCheckout(): void {
    const currentCart = this.cart();
    if (!currentCart || !currentCart.items || currentCart.items.length === 0) {
      this.toastr.warning("Giỏ hàng của bạn đang trống.");
      return;
    }

    this.cartService.isLoading.set(true);
    this.cartService.validateCart()
      .pipe(finalize(() => this.cartService.isLoading.set(false)))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            const validationData = res.data as CartValidationResponse;

            // Kịch bản 1: Có sự điều chỉnh trong giỏ hàng
            if (validationData.adjustments && validationData.adjustments.length > 0) {
              // Tạo nội dung thông báo từ danh sách adjustments
              const adjustmentMessages = validationData.adjustments.map(adj => `- ${adj.message}`).join('\n');
              const modalMessage = `Một vài sản phẩm trong giỏ hàng của bạn đã có thay đổi:\n\n${adjustmentMessages}\n\nVui lòng kiểm tra lại giỏ hàng trước khi tiếp tục.`;

              // Hiển thị modal thông báo
              this.confirmationService.open({
                title: 'Giỏ Hàng Đã Được Cập Nhật',
                message: modalMessage,
                confirmText: 'Đến trang Checkout',
                cancelText: 'Xem lại giỏ hàng',
                confirmButtonClass: 'btn-primary',
                iconClass: 'fas fa-info-circle',
                iconColorClass: 'text-info'
              }).subscribe(confirmed => {
                // Tải lại giỏ hàng để cập nhật UI
                this.cartService.loadCart().subscribe();
                if (confirmed) {
                  // Nếu người dùng vẫn muốn checkout, điều hướng họ đi
                  this.router.navigate(['/checkout']);
                }
                // Nếu nhấn "Xem lại giỏ hàng", họ sẽ ở lại trang cart
              });

            } else if (validationData.valid) {
              // Kịch bản 2: Giỏ hàng hợp lệ và không có điều chỉnh -> đi đến checkout
              this.router.navigate(['/checkout']);
            } else {
              // Kịch bản 3: Giỏ hàng không hợp lệ mà không rõ lý do
              this.confirmationService.open({
                title: 'Giỏ Hàng Không Hợp Lệ',
                message: res.message || "Giỏ hàng của bạn không hợp lệ để thanh toán. Vui lòng kiểm tra lại.",
                confirmText: 'OK',
                cancelText: 'Đóng',
                confirmButtonClass: 'btn-error'
              });
            }
          } else {
            // Lỗi từ API validate
            this.toastr.error(res.message || "Lỗi khi kiểm tra giỏ hàng.");
          }
        },
        error: (err) => {
          // Lỗi kết nối
          this.toastr.error(err.error?.message || "Lỗi kết nối khi kiểm tra giỏ hàng.");
        }
      });
  }
  // Helper quản lý loading map
  isItemLoading(itemId: number): boolean {
    return this.itemLoadingMap.get(itemId) ?? false;
  }
  private setItemLoading(itemId: number, isLoading: boolean): void {
    if (isLoading) {
      this.itemLoadingMap.set(itemId, true);
    } else {
      this.itemLoadingMap.delete(itemId);
    }
    this.cdr.markForCheck(); // Thông báo cho Angular kiểm tra thay đổi (do dùng OnPush)
  }

  // Helper xử lý lỗi chung
  private handleError(err: any, defaultMessage: string, itemId?: number, oldQuantity?: number, productName?: string): void {
    const apiResponseError = err.error as ApiResponse<null>; // Lấy lỗi từ body response
    let message = defaultMessage; // Mặc định
    const displayProductName = productName ?? 'sản phẩm'; // Lấy tên SP hoặc dùng mặc định

    if (apiResponseError?.details?.['errorCode'] === 'ERR_OUT_OF_STOCK') {
      // Xử lý lỗi hết hàng cụ thể
      const serverAvailableStock = apiResponseError.details['availableStock'] as number | undefined;

      if (serverAvailableStock != null && serverAvailableStock >= 0 && itemId) { // Cần itemId để reset
        message = `Cập nhật thất bại. Chỉ còn ${serverAvailableStock} ${displayProductName} trong kho.`;
        // Reset lại UI và state về số lượng đúng
        const inputElement = document.getElementById(`quantity-input-${itemId}`) as HTMLInputElement | null;
        if(inputElement) {
          inputElement.value = serverAvailableStock.toString();
        }
        // Yêu cầu CartService cập nhật lại state (quan trọng)
        this.cartService.forceCartItemQuantityUpdate(itemId, serverAvailableStock);
      } else {
        // Nếu không có availableStock hoặc itemId, hiển thị lỗi chung hơn
        message = `Cập nhật thất bại. Số lượng ${displayProductName} không đủ.`;
        // Nếu có oldQuantity, thử reset về giá trị cũ
        if (itemId && oldQuantity !== undefined) {
          const inputElement = document.getElementById(`quantity-input-${itemId}`) as HTMLInputElement | null;
          if(inputElement) inputElement.value = oldQuantity.toString();
          this.cartService.forceCartItemQuantityUpdate(itemId, oldQuantity);
        }
      }

    } else if (apiResponseError?.message) {
      // Lấy message từ ApiResponse nếu có cho các lỗi khác
      message = apiResponseError.message;
      // Nếu là lỗi khác khi cập nhật số lượng, reset về số cũ
      if(itemId && oldQuantity !== undefined) {
        const inputElement = document.getElementById(`quantity-input-${itemId}`) as HTMLInputElement | null;
        if(inputElement) inputElement.value = oldQuantity.toString();
        this.cartService.forceCartItemQuantityUpdate(itemId, oldQuantity);
      }
    } else if (err?.message) {
      // Lấy message từ lỗi chung nếu không có ApiResponse
      message = err.message;
    }

    // this.errorMessage.set(message); // Chỉ hiển thị lỗi chung nếu thực sự cần thiết
    this.toastr.error(message); // Hiển thị toast lỗi cụ thể
    console.error('API Error:', err);
    this.cdr.markForCheck(); // Thông báo thay đổi
  }


  // Hàm trackBy cho *ngFor
  trackCartItemById(index: number, item: CartItemResponse): number {
    return item.id;
  }
}
