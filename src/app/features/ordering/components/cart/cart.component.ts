import { Component, inject, signal, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core'; // Thêm ChangeDetection
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { CartResponse } from '../../dto/response/CartResponse';
import { CartItemResponse } from '../../dto/response/CartItemResponse';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { CartItemUpdateRequest } from '../../dto/request/CartItemUpdateRequest';
import { Observable, Subject } from 'rxjs'; // Import Subject
import { takeUntil, finalize } from 'rxjs/operators'; // Import takeUntil, finalize
import { NgxSpinnerService } from 'ngx-spinner'; // Ví dụ dùng thư viện spinner khác
import { ToastrService } from 'ngx-toastr'; // Ví dụ dùng thư viện toastr
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';
import {ApiResponse} from '../../../../core/models/api-response.model';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, DecimalPipe, LoadingSpinnerComponent, AlertComponent, FormatBigDecimalPipe ],
  templateUrl: './cart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush // Tối ưu change detection
})
export class CartComponent {
  cartService = inject(CartService);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef); // Inject ChangeDetectorRef
  spinner = inject(NgxSpinnerService); // Inject spinner service
  toastr = inject(ToastrService); // Inject toastr service

  cart$: Observable<CartResponse | null> = this.cartService.cart$;
  isLoading = this.cartService.isLoading;
  // Dùng Map để quản lý loading cho từng item hiệu quả hơn signal lồng
  itemLoadingMap = new Map<number, boolean>();
  clearLoading = signal(false);
  errorMessage = signal<string | null>(null);

  private destroy$ = new Subject<void>(); // Subject để unsubscribe

  ngOnInit(): void {
    // Không cần gọi loadCart vì service đã tự load khi user login
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

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

    // Đảm bảo số lượng không nhỏ hơn 1
    if (newQuantity < 1) {
      newQuantity = 1;
    }

    const availableStock = item.product.stockQuantity ?? 0;
    const oldQuantity = item.quantity;

    // ****** THÊM KIỂM TRA TỒN KHO CLIENT-SIDE ******
    if (newQuantity > availableStock) {
      this.toastr.error(`Chỉ còn ${availableStock} ${item.product.name} trong kho.`);
      // Set lại giá trị input về mức tối đa
      const inputElement = document.getElementById(`quantity-input-${item.id}`) as HTMLInputElement | null;
      if(inputElement) inputElement.value = availableStock.toString();
      // Không gọi API nếu số lượng yêu cầu đã vượt quá tồn kho
      return;
    }
    // **********************************************

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
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ giỏ hàng?')) {
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
  }

  goToCheckout(): void {
    const currentCart = this.cartService.getCurrentCart();
    if (currentCart && currentCart.items && currentCart.items.length > 0) {
      this.router.navigate(['/checkout']);
    } else {
      this.toastr.warning("Giỏ hàng của bạn đang trống.");
    }
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
  // ******************************

  // Hàm trackBy cho *ngFor
  trackCartItemById(index: number, item: CartItemResponse): number {
    return item.id;
  }
}
