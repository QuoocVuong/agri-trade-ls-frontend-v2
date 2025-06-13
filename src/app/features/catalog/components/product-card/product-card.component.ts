import {Component, Input, inject, signal, EventEmitter, Output, ChangeDetectorRef} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common'; // Import DecimalPipe
import {Router, RouterLink} from '@angular/router';
import { ProductSummaryResponse } from '../../dto/response/ProductSummaryResponse';
import { CartService } from '../../../ordering/services/cart.service'; // Import CartService
import { FavoriteService } from '../../../interaction/service/FavoriteService'; // Import FavoriteService
import { AuthService } from '../../../../core/services/auth.service'; // Import AuthService
import { ToastrService } from 'ngx-toastr';
import {Subject} from 'rxjs';
import {finalize, takeUntil} from 'rxjs/operators';
import {CartItemRequest} from '../../../ordering/dto/request/CartItemRequest';
import {ApiResponse} from '../../../../core/models/api-response.model';
import {FormatBigDecimalPipe} from '../../../../shared/pipes/format-big-decimal.pipe';
import BigDecimal from 'js-big-decimal';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink, FormatBigDecimalPipe], // Thêm DecimalPipe
  templateUrl: './product-card.component.html',
})
export class ProductCardComponent {
  @Input({ required: true }) product!: ProductSummaryResponse; // Nhận product từ component cha
  @Output() unfavorited = new EventEmitter<number>();

  private cartService = inject(CartService);
  private favoriteService = inject(FavoriteService);
  private authService = inject(AuthService);
  private toastr = inject(ToastrService); // Inject Toastr
  private destroy$ = new Subject<void>(); // Để unsubscribe
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  isAddingToCart = signal(false);
  isTogglingFavorite = signal(false);
  // TODO: Cần signal hoặc cách kiểm tra xem sản phẩm này đã có trong favorite list chưa
  isFavorite = signal(false); // Ví dụ

  // Lấy trạng thái đăng nhập
  isAuthenticated = this.authService.isAuthenticated;

  // ****** THÊM SIGNAL XÁC ĐỊNH VAI TRÒ ******
  isBusinessBuyer = this.authService.hasRoleSignal('ROLE_BUSINESS_BUYER');
  // *****************************************





  ngOnInit(): void {
    // Kiểm tra trạng thái yêu thích ban đầu nếu user đăng nhập
    console.log('ProductCard Input:', this.product); // Xem toàn bộ object
    console.log('ProductCard Input - New:', this.product?.new); // Xem giá trị cụ thể
    if (this.isAuthenticated() && this.product) {
      this.checkFavoriteStatus();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  checkFavoriteStatus(): void {
    this.favoriteService.isFavorite(this.product.id) // Service chỉ cần productId
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (isFav) => this.isFavorite.set(isFav),
        // Không cần xử lý lỗi ở đây, chỉ là kiểm tra trạng thái
        // error: (err) => console.error("Error checking favorite status", err)
      });
  }



  addToCart(event: MouseEvent): void {
    event.preventDefault(); // Ngăn không điều hướng khi bấm nút trong thẻ a
    event.stopPropagation(); // Ngăn sự kiện nổi bọt lên thẻ a cha

    if (!this.isAuthenticated()) {
      this.toastr.info('Vui lòng đăng nhập để thêm vào giỏ hàng.');
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }


    // ****** KIỂM TRA TỒN KHO VÀ SỐ LƯỢNG TRONG GIỎ TRƯỚC ******
    const availableStock = this.product.stockQuantity ?? 0;
    const productName = this.product.name ?? 'Sản phẩm';

    if (availableStock <= 0) {
      this.toastr.error(`${this.product.name} đã hết hàng.`);
      return;
    }

    // // Lấy số lượng hiện có trong giỏ hàng (đồng bộ từ CartService)
    // const currentCart = this.cartService.getCurrentCart(); // Lấy state hiện tại
    // const itemInCart = currentCart?.items.find(item => item.product?.id === this.product.id);
    // const quantityInCart = itemInCart?.quantity ?? 0;
    //
    // // ****** KIỂM TRA CLIENT-SIDE ******
    // if (quantityInCart >= availableStock) {
    //   this.toastr.error(`Bạn đã có số lượng tối đa (${availableStock}) của "${productName}" trong giỏ hàng.`);
    //   this.cdr.markForCheck();
    //   return; // Không gọi API nữa
    // }
    // // **********************************************************

    // Lấy số lượng trong giỏ TRƯỚC KHI THÊM
    const currentCart = this.cartService.getCurrentCart();
    const itemInCart = currentCart?.items.find(item => item.product?.id === this.product.id);
    const quantityInCartBeforeAdd = itemInCart?.quantity ?? 0; // Lưu lại số lượng cũ

    // Kiểm tra client-side trước khi gọi API
    if (quantityInCartBeforeAdd >= availableStock) { // Chỉ cần >= vì từ card luôn thêm 1
      this.toastr.error(`Số lượng "${productName}" trong giỏ đã đạt mức tối đa (${availableStock}).`);
      this.cdr.markForCheck();
      return; // Không gọi API
    }


    // // ****** THÊM KIỂM TRA TỒN KHO CLIENT-SIDE ******
    // if (this.product.stockQuantity <= 0) {
    //   this.toastr.error(`${this.product.name} đã hết hàng.`);
    //   return; // Không gọi API nếu đã biết hết hàng
    // }
    // // **********************************************


    this.isAddingToCart.set(true);
    // Nút "Thêm" trên card thường chỉ thêm 1 đơn vị
    const request: CartItemRequest = { productId: this.product.id, quantity: 1 };

    this.cartService.addItem(request) // Service sẽ tự lấy user từ AuthService nếu cần
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isAddingToCart.set(false);
          this.cdr.markForCheck(); // Đảm bảo cập nhật trạng thái nút loading
        })
      )
      .subscribe({ // Giả sử service cần user
        next: () => {
          console.log('Added to cart:', this.product.name);
          this.toastr.success(`Đã thêm "${productName}" vào giỏ hàng!`);
          // // ****** THÊM KIỂM TRA SAU KHI THÊM THÀNH CÔNG ******
          // const updatedCart = this.cartService.getCurrentCart(); // Lấy lại giỏ hàng mới nhất
          // const addedItem = updatedCart?.items.find(item => item.product?.id === this.product.id);
          // const newQuantityInCart = addedItem?.quantity ?? 0;
          // const stock = this.product.stockQuantity ?? 0; // Lấy lại stock (mặc dù ít thay đổi ở đây)
          //
          // // Kiểm tra nếu số lượng mới bằng tồn kho
          // if (newQuantityInCart > 0 && stock > 0 && newQuantityInCart === stock) {
          //   // Dùng timeout nhỏ để toastr không bị đè lên nhau quá nhanh (tùy chọn)
          //   setTimeout(() => {
          //     this.toastr.info(`Đã đạt số lượng tối đa (${stock}) cho "${productName}" trong giỏ hàng.`);
          //     this.cdr.markForCheck(); // Đảm bảo toastr thứ 2 hiển thị
          //   }, 100); // 100ms delay
          // }
          // // ****************************************************
          // ****** KIỂM TRA DỰA TRÊN SỐ LƯỢNG CŨ VÀ SỐ LƯỢNG VỪA THÊM (là 1) ******
          const expectedNewQuantityInCart = quantityInCartBeforeAdd + 1;
          const stock = this.product.stockQuantity ?? 0;

          console.log(`--- After Add Success (Product ID: ${this.product.id}) ---`);
          console.log(`Stock: ${stock}`);
          console.log(`Quantity Before Add: ${quantityInCartBeforeAdd}`);
          console.log(`Quantity Added: 1`);
          console.log(`Expected New Quantity: ${expectedNewQuantityInCart}`);
          console.log(`Is Expected New Quantity === Stock? : ${expectedNewQuantityInCart === stock}`);

          // Kiểm tra nếu số lượng mới bằng tồn kho
          if (expectedNewQuantityInCart > 0 && stock > 0 && expectedNewQuantityInCart === stock) {
            console.log('>>> Condition MET! Showing info toastr.');
            setTimeout(() => {
              this.toastr.info(`Đã đạt số lượng tối đa (${stock}) cho "${productName}" trong giỏ hàng.`);
              this.cdr.markForCheck();
            }, 100);
          } else {
            console.log('>>> Condition NOT MET.');
          }
          // ******************************************************************
        },
        // *** Sửa kiểu dữ liệu cho err ***
        error: (err: any) => { // Dùng any hoặc HttpErrorResponse
          console.error('Error adding to cart from product card:', err);
          const apiResponseError = err.error as ApiResponse<null>; // Ép kiểu lỗi

          // ****** SỬA XỬ LÝ LỖI API ******
          if (apiResponseError?.details?.['errorCode'] === 'ERR_OUT_OF_STOCK') {
            const serverAvailableStock = apiResponseError.details['availableStock'] as number | undefined;

            //Lấy lại số lượng trong giỏ (có thể đã được cập nhật bởi người khác)
            // Hoặc dựa vào thông báo lỗi của backend nếu có (ví dụ: "requested total: 10")
            const currentQtyInCart = this.cartService.getCurrentCart()?.items.find(i => i.product?.id === this.product.id)?.quantity ?? 0
            // Kiểm tra xem lỗi có phải do giỏ hàng đã đầy không

            if (serverAvailableStock != null && currentQtyInCart >= serverAvailableStock) {
              this.toastr.error(`Số lượng "${productName}" trong giỏ đã đạt mức tối đa (${serverAvailableStock}). Không thể thêm nữa.`);
            } else if (serverAvailableStock != null && serverAvailableStock > 0) {
              // Trường hợp stock bị giảm đột ngột
              this.toastr.error(`Không thể thêm. Số lượng "${productName}" trong kho không đủ (còn ${serverAvailableStock}).`);
              if (this.product.stockQuantity !== serverAvailableStock) {
                this.product.stockQuantity = serverAvailableStock;
              }
            } else {
              // Stock về 0
              this.toastr.error(`Không thể thêm. "${productName}" vừa hết hàng.`);
              this.product.stockQuantity = 0; // Cập nhật stock cục bộ
            }
          } else {
            // Lỗi khác
            const message = apiResponseError?.message || err?.message || 'Lỗi thêm vào giỏ hàng.';
            this.toastr.error(message);
          }
          this.cdr.markForCheck();
        }
        // **********************************
      });
  }

  toggleFavorite(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.isAuthenticated()) {
      this.toastr.info('Vui lòng đăng nhập để yêu thích sản phẩm.');
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }


    this.isTogglingFavorite.set(true);
    const currentIsFavorite = this.isFavorite(); // Lấy trạng thái hiện tại từ signal

    //*** Sửa tham số gọi service ***
    const action = currentIsFavorite
      ? this.favoriteService.removeFavorite(this.product.id) // Chỉ cần productId
      : this.favoriteService.addFavorite(this.product.id);    // Chỉ cần productId

    action
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isTogglingFavorite.set(false);
          this.cdr.markForCheck(); // Đảm bảo cập nhật trạng thái nút loading/icon
        })
      )
      .subscribe({
        next: () => {
          this.isFavorite.set(!currentIsFavorite); // Đảo trạng thái thành công
          const message = currentIsFavorite ? 'Đã xóa khỏi yêu thích' : 'Đã thêm vào yêu thích';
          this.toastr.success(message);
          // Nếu bỏ thích, phát sự kiện unfavorited
          if (currentIsFavorite) {
            this.unfavorited.emit(this.product.id);
          }
          this.cdr.markForCheck(); // Cập nhật icon trái tim
        },
        error: (err: ApiResponse<any> | any) => {
          const message = err?.message || 'Thao tác thất bại.';
          this.toastr.error(message);
          console.error('Error toggling favorite:', err);
          this.cdr.markForCheck(); // Đảm bảo toastr hiển thị
        }
      });
  }

  // ****** THÊM HÀM HELPER LẤY GIÁ/ĐƠN VỊ HIỂN THỊ ******
  getDisplayInfo(): { price: string | number | BigDecimal | null, unit: string | null } {
    if (!this.product) {
      return { price: null, unit: 'N/A' };
    }
    // Nếu là Business Buyer và sản phẩm có hỗ trợ B2B -> hiển thị giá B2B cơ bản
    if (this.isBusinessBuyer() && this.product.b2bEnabled) { // Giả sử tên trường là b2bEnabled
      // Ưu tiên giá B2B cơ bản, nếu không có thì dùng giá B2C
      const priceToShow = this.product.b2bBasePrice ?? this.product.price;
      const unitToShow = this.product.b2bUnit ?? this.product.unit; // Ưu tiên đơn vị B2B
      return { price: priceToShow, unit: unitToShow };
    } else {
      // Mặc định hiển thị giá và đơn vị B2C
      return { price: this.product.price, unit: this.product.unit };
    }
  }
  // *****************************************************

  // Hàm trackBy (nếu component này dùng *ngFor, mặc dù hiện tại không)
  trackById(index: number, item: any): number {
    return item.id;
  }
}
