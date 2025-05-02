import {Injectable, signal, inject, computed, effect} from '@angular/core';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {BehaviorSubject, Observable, tap, finalize, of, throwError} from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { CartResponse } from '../dto/response/CartResponse';
import { CartItemResponse } from '../dto/response/CartItemResponse';
import { CartItemRequest } from '../dto/request/CartItemRequest';
import { CartItemUpdateRequest } from '../dto/request/CartItemUpdateRequest';
import { AuthService } from '../../../core/services/auth.service';
import BigDecimal from 'js-big-decimal';
import {catchError} from 'rxjs/operators'; // Import AuthService

@Injectable({
  providedIn: 'root' // Cung cấp ở root để dễ dàng truy cập từ header/các nơi khác
})
export class CartService {
  private http = inject(HttpClient);
  private authService = inject(AuthService); // Inject AuthService
  private apiUrl = `${environment.apiUrl}/cart`;

  // Sử dụng BehaviorSubject để lưu trữ và phát ra trạng thái giỏ hàng
  // Khởi tạo với giá trị null hoặc một trạng thái mặc định
  private cartSubject = new BehaviorSubject<CartResponse | null>(null);
  public cart$ = this.cartSubject.asObservable(); // Observable cho các component theo dõi

  // Signal chứa thông tin giỏ hàng đầy đủ
  private cartState = signal<CartResponse | null>(null);
  // Signal chỉ chứa số lượng item (để header dùng)
  public readonly totalItems = computed(() => this.cartState()?.totalItems ?? 0); // Tính toán từ cartState
  // Public readonly signal cho giỏ hàng đầy đủ
  public readonly currentCart = this.cartState.asReadonly();

  // Signal cho trạng thái loading của các thao tác giỏ hàng
  public isLoading = signal(false);


  constructor() {
    // Tự động tải giỏ hàng khi người dùng đăng nhập
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.loadCart().subscribe(); // Tải giỏ hàng khi user thay đổi hoặc token xuất hiện
      } else {
        this.cartSubject.next(null); // Xóa giỏ hàng khi logout
      }
    }, { allowSignalWrites: true }); // Cần thiết nếu effect ghi vào signal khác (dù ở đây ko có)


  }

  // Lấy giá trị giỏ hàng hiện tại (đồng bộ)
  getCurrentCart(): CartResponse | null {
    return this.cartSubject.getValue();
  }

  // Signal tính toán tổng số lượng item trong giỏ
  //public totalItems = computed(() => this.cartSubject.value?.totalItems ?? 0);

  // Tải giỏ hàng từ API
  loadCart(): Observable<ApiResponse<CartResponse>> {
    this.isLoading.set(true);
    return this.http.get<ApiResponse<CartResponse>>(this.apiUrl).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.cartSubject.next(response.data); // Cập nhật state
          this.cartState.set(response.data);
        } else {
          this.cartSubject.next(null); // Xóa state nếu lỗi hoặc không có data
          console.error("Failed to load cart:", response.message);
          this.cartState.set({ items: [], subTotal: 0, totalItems: 0 }); // Set giỏ hàng rỗng nếu lỗi hoặc không có data
        }
      }),
      catchError(err => {
        console.error("Error loading cart:", err);
        this.cartState.set({ items: [], subTotal: 0, totalItems: 0 }); // Set giỏ hàng rỗng khi lỗi
        return of(err); // Trả về lỗi để component khác có thể xử lý nếu cần
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  // Thêm item vào giỏ
  addItem(request: CartItemRequest): Observable<ApiResponse<CartItemResponse>> {
    this.isLoading.set(true);
    return this.http.post<ApiResponse<CartItemResponse>>(`${this.apiUrl}/items`, request).pipe(
      tap(response => {
        if (response.success) {
          this.loadCart().subscribe(); // Tải lại giỏ hàng sau khi thêm thành công
        }
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  // Cập nhật số lượng item
  updateItemQuantity(cartItemId: number, request: CartItemUpdateRequest): Observable<ApiResponse<CartItemResponse>> {
    this.isLoading.set(true);
    return this.http.put<ApiResponse<CartItemResponse>>(`${this.apiUrl}/items/${cartItemId}`, request).pipe(
      tap(response => {
        if (response.success) {
          this.loadCart().subscribe(); // Tải lại giỏ hàng
        }
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  // Xóa item khỏi giỏ
  removeItem(cartItemId: number): Observable<ApiResponse<void>> {
    this.isLoading.set(true);
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/items/${cartItemId}`).pipe(
      tap(response => {
        if (response.success) {
          this.loadCart().subscribe(); // Tải lại giỏ hàng
        }
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  // Xóa toàn bộ giỏ hàng
  clearCart(): Observable<ApiResponse<void>> {
    this.isLoading.set(true);
    return this.http.delete<ApiResponse<void>>(this.apiUrl).pipe(
      tap(response => {
        if (response.success) {
          this.cartSubject.next({ items: [], subTotal: new BigDecimal("0"), totalItems: 0 }); // Cập nhật state ngay lập tức
          this.cartState.set({ items: [], subTotal: 0, totalItems: 0 }); // Cập nhật state ngay lập tức
        }


      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  // ****** THÊM HÀM NÀY ******
  // Hàm để component gọi khi cần cập nhật số lượng item trong state mà không gọi API
  forceCartItemQuantityUpdate(itemId: number, newQuantity: number): void {
    const currentCart = this.getCurrentCart();
    if (currentCart) {
      const updatedItems = currentCart.items.map(item => {
        if (item.id === itemId) {
          // Cập nhật số lượng và tính lại itemTotal
          const updatedItem = { ...item, quantity: newQuantity };
          if (updatedItem.product?.price) {
            // Cẩn thận với kiểu dữ liệu price (string, number, BigDecimal?)
            // Giả sử price là string hoặc number có thể chuyển đổi
            const price = new BigDecimal(updatedItem.product.price.toString());
            updatedItem.itemTotal = price.multiply(new BigDecimal(newQuantity));
          } else {
            updatedItem.itemTotal = new BigDecimal(0);
          }
          return updatedItem;
        }
        return item;
      });

      // Tính lại subTotal và totalItems
      const newSubTotal = updatedItems.reduce((sum, item) => {
        const itemTotal = item.itemTotal instanceof BigDecimal ? item.itemTotal : new BigDecimal(item.itemTotal?.toString() ?? '0');
        return sum.add(itemTotal);
      }, new BigDecimal(0));
      const newTotalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);

      // Cập nhật BehaviorSubject
      this.cartSubject.next({
        items: updatedItems,
        subTotal: newSubTotal, // Trả về BigDecimal hoặc string tùy bạn muốn
        totalItems: newTotalItems
      });
    }
  }
  // ****************************

  // Thông báo cập nhật (nếu cần cho các component khác lắng nghe)
  notifyCartUpdated(): void {
    const currentCart = this.getCurrentCart();
    if(currentCart) {
      this.cartSubject.next({...currentCart}); // Phát ra giá trị mới (bản sao)
    }
  }


  private handleError(error: HttpErrorResponse): Observable<never> {
    // Trả về lỗi để component có thể xử lý
    return throwError(() => error);
  }
}
