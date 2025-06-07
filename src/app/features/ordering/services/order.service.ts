import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PagedApiResponse } from '../../../core/models/api-response.model';
import { OrderResponse } from '../dto/response/OrderResponse';
import { OrderSummaryResponse } from '../dto/response/OrderSummaryResponse';
import { CheckoutRequest } from '../dto/request/CheckoutRequest';
import { OrderStatusUpdateRequest } from '../dto/request/OrderStatusUpdateRequest';
import { OrderStatus } from '../domain/order-status.enum';
import {OrderCalculationResponse} from '../dto/response/OrderCalculationResponse';
import {PaymentMethod} from '../domain/payment-method.enum';
import {PaymentUrlResponse} from '../dto/response/PaymentUrlResponse';
import {BankTransferInfoResponse} from '../dto/response/BankTransferInfoResponse';
import {AgreedOrderRequest} from '../dto/request/AgreedOrderRequest'; // Import Enum

// Interface cho tham số tìm kiếm đơn hàng của Farmer
export interface FarmerOrderSearchParams {
  page?: number;
  size?: number;
  sort?: string;
  keyword?: string | null; // Tìm theo mã đơn hàng, tên người mua
  status?: OrderStatus | string | null; // Lọc theo OrderStatus
}

export interface BuyerOrderSearchParams {
  page: number;
  size: number;
  sort?: string;
  keyword?: string | null;
  status?: OrderStatus | string | null;
}


@Injectable({
  providedIn: 'root' // Cung cấp ở root vì nhiều nơi có thể cần xem đơn hàng
})
export class OrderService {
  private http = inject(HttpClient);
  private orderApiUrl = `${environment.apiUrl}/orders`;
  private farmerOrderApiUrl = `${environment.apiUrl}/farmer/orders`;
  private adminOrderApiUrl = `${environment.apiUrl}/admin/orders`;
  private InvoiceApiUrl  = `${environment.apiUrl}`;
  private invoiceDownloadApiUrl = `${environment.apiUrl}/invoices`;

  // --- Buyer APIs ---
  checkout(request: CheckoutRequest): Observable<ApiResponse<OrderResponse[]>> { // Backend trả về List<OrderResponse>
    return this.http.post<ApiResponse<OrderResponse[]>>(`${this.orderApiUrl}/checkout`, request);
  }

  getMyOrdersAsBuyer(params: BuyerOrderSearchParams): Observable<PagedApiResponse<OrderSummaryResponse>> {
      let httpParams = new HttpParams()
        .set('page', params.page.toString())
        .set('size', params.size.toString());
      if (params.sort) httpParams = httpParams.set('sort', params.sort);
      if (params.keyword?.trim()) httpParams = httpParams.set('keyword', params.keyword.trim());
      if (params.status) httpParams = httpParams.set('status', params.status.toString());
      return this.http.get<PagedApiResponse<OrderSummaryResponse>>(`${this.orderApiUrl}/my`, { params: httpParams });
    }

  getMyOrderDetailsById(orderId: number): Observable<ApiResponse<OrderResponse>> {
    return this.http.get<ApiResponse<OrderResponse>>(`${this.orderApiUrl}/${orderId}`);
  }

  getMyOrderDetailsByCode(orderCode: string): Observable<ApiResponse<OrderResponse>> {
    return this.http.get<ApiResponse<OrderResponse>>(`${this.orderApiUrl}/code/${orderCode}`);
  }

  cancelMyOrder(orderId: number): Observable<ApiResponse<OrderResponse>> {
    return this.http.post<ApiResponse<OrderResponse>>(`${this.orderApiUrl}/${orderId}/cancel`, {});
  }

  // ****** THÊM PHƯƠNG THỨC NÀY ******
  /**
   * Gọi API backend để tạo URL thanh toán cho một đơn hàng với phương thức thanh toán cụ thể.
   * @param orderId ID của đơn hàng
   * @param paymentMethod Phương thức thanh toán (VNPAY, MOMO, ...)
   * @returns Observable chứa ApiResponse với PaymentUrlResponse
   */
  createPaymentUrl(orderId: number, paymentMethod: PaymentMethod): Observable<ApiResponse<PaymentUrlResponse>> {
    let params = new HttpParams().set('paymentMethod', paymentMethod); // Gửi paymentMethod làm query param
    // Backend endpoint là: POST /api/orders/{orderId}/create-payment-url
    return this.http.post<ApiResponse<PaymentUrlResponse>>(`${this.orderApiUrl}/${orderId}/create-payment-url`, null, { params });
    // Truyền null cho body nếu API POST không yêu cầu body, chỉ cần query param
  }
  // **********************************

  getBankTransferInfo(orderId: number): Observable<ApiResponse<BankTransferInfoResponse>> {
    return this.http.get<ApiResponse<BankTransferInfoResponse>>(`${this.orderApiUrl}/${orderId}/bank-transfer-info`);
  }

  // --- Farmer APIs ---
  getMyOrdersAsFarmer(params: FarmerOrderSearchParams): Observable<PagedApiResponse<OrderSummaryResponse>> {
    let httpParams  = new HttpParams()
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
    if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
    if (params.sort) httpParams = httpParams.set('sort', params.sort);

    // THÊM XỬ LÝ CHO KEYWORD VÀ STATUS
    if (params.keyword?.trim()) { // Kiểm tra trim() để không gửi chuỗi rỗng
      httpParams = httpParams.set('keyword', params.keyword.trim());
    }
    if (params.status) {
      httpParams = httpParams.set('status', params.status.toString()); // Gửi status dưới dạng string
    }

    return this.http.get<PagedApiResponse<OrderSummaryResponse>>(`${this.farmerOrderApiUrl}/my`, { params: httpParams });
  }

  getFarmerOrderDetails(orderId: number): Observable<ApiResponse<OrderResponse>> {
    // Dùng chung API getMyOrderDetailsById vì backend đã kiểm tra quyền
    return this.http.get<ApiResponse<OrderResponse>>(`${this.orderApiUrl}/${orderId}`);
    // Hoặc dùng API riêng của farmer nếu có:
    // return this.http.get<ApiResponse<OrderResponse>>(`${this.farmerOrderApiUrl}/${orderId}`);
  }

  updateFarmerOrderStatus(orderId: number, request: OrderStatusUpdateRequest): Observable<ApiResponse<OrderResponse>> {
    return this.http.put<ApiResponse<OrderResponse>>(`${this.farmerOrderApiUrl}/${orderId}/status`, request);
  }


  // --- Admin APIs ---
  getAllOrdersForAdmin(params: { status?: OrderStatus | string | null, buyerId?: number | null, farmerId?: number | null, page?: number, size?: number, sort?: string }): Observable<PagedApiResponse<OrderSummaryResponse>> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status.toString());
    if (params.buyerId) httpParams = httpParams.set('buyerId', params.buyerId.toString());
    if (params.farmerId) httpParams = httpParams.set('farmerId', params.farmerId.toString());
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
    if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    return this.http.get<PagedApiResponse<OrderSummaryResponse>>(`${this.adminOrderApiUrl}`, { params: httpParams });
  }

  getAdminOrderDetails(orderId: number): Observable<ApiResponse<OrderResponse>> {
    return this.http.get<ApiResponse<OrderResponse>>(`${this.adminOrderApiUrl}/${orderId}`);
  }

  updateAdminOrderStatus(orderId: number, request: OrderStatusUpdateRequest): Observable<ApiResponse<OrderResponse>> {
    return this.http.put<ApiResponse<OrderResponse>>(`${this.adminOrderApiUrl}/${orderId}/status`, request);
  }

  cancelOrderByAdmin(orderId: number): Observable<ApiResponse<OrderResponse>> {
    return this.http.post<ApiResponse<OrderResponse>>(`${this.adminOrderApiUrl}/${orderId}/cancel`, {});
  }

  // Trong OrderService.ts
  downloadInvoice(orderId: number): Observable<Blob> { // Trả về Blob
    const url = `${this.orderApiUrl}/${orderId}/invoice/download`; // Hoặc /api/orders/...
    return this.http.get(url, { responseType: 'blob' }); // Yêu cầu response dạng blob
  }

  // OrderService.ts (Frontend)
  calculateTotals(request: { shippingAddressId: number | null }): Observable<ApiResponse<OrderCalculationResponse>> {
    return this.http.post<ApiResponse<OrderCalculationResponse>>(`${this.orderApiUrl}/calculate-totals`, request);
  }

  // --- THÊM PHƯƠNG THỨC MỚI CHO ĐƠN HÀNG THỎA THUẬN ---
  /**
   * Gọi API backend để tạo một "Đơn hàng thỏa thuận".
   * @param request Dữ liệu của đơn hàng thỏa thuận.
   * @returns Observable chứa ApiResponse với OrderResponse của đơn hàng vừa tạo.
   */
  createAgreedOrder(request: AgreedOrderRequest): Observable<ApiResponse<OrderResponse>> {
    // Endpoint backend là: POST /api/orders/agreed-order
    // Giả sử endpoint chung là /api/orders/agreed-order và backend sẽ kiểm tra quyền của người gọi
    return this.http.post<ApiResponse<OrderResponse>>(`${this.orderApiUrl}/agreed-order`, request);
  }
  // ----------------------------------------------------

  /**
   * Tải PDF hóa đơn theo Order ID.
   * @param orderId ID của đơn hàng.
   * @returns Observable chứa Blob của file PDF.
   */
  downloadInvoiceByOrderId(orderId: number): Observable<Blob> {
    const url = `${this.orderApiUrl}/${orderId}/invoice/download`;
    return this.http.get(url, { responseType: 'blob' });
  }

  /**
   * Tải PDF hóa đơn theo Invoice ID.
   * @param invoiceId ID của hóa đơn.
   * @returns Observable chứa Blob của file PDF.
   */
  downloadInvoiceByInvoiceId(invoiceId: number): Observable<Blob> {
    const url = `${this.invoiceDownloadApiUrl}/${invoiceId}/download`; // API backend: /api/invoices/{invoiceId}/download
    return this.http.get(url, { responseType: 'blob' });
  }

}
