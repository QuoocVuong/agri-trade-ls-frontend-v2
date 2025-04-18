import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PagedApiResponse } from '../../../core/models/api-response.model'; // Import Page
import { OrderResponse } from '../../ordering/dto/response/OrderResponse';
import { OrderSummaryResponse } from '../../ordering/dto/response/OrderSummaryResponse';
import { OrderStatusUpdateRequest } from '../../ordering/dto/request/OrderStatusUpdateRequest';
import { OrderStatus } from '../../ordering/domain/order-status.enum';

@Injectable({
  providedIn: 'root'
})
export class AdminOrderingService {
  private http = inject(HttpClient);
  private adminOrderApiUrl = `${environment.apiUrl}/admin/orders`;

  getAllOrdersForAdmin(params: { status?: OrderStatus | string | null, buyerId?: number | null, farmerId?: number | null, keyword?: string | null, page?: number, size?: number, sort?: string }): Observable<PagedApiResponse<OrderSummaryResponse>> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status.toString());
    if (params.buyerId) httpParams = httpParams.set('buyerId', params.buyerId.toString());
    if (params.farmerId) httpParams = httpParams.set('farmerId', params.farmerId.toString());
    if (params.keyword) httpParams = httpParams.set('keyword', params.keyword); // Thêm tìm kiếm (vd: theo mã đơn)
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
    if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    return this.http.get<PagedApiResponse<OrderSummaryResponse>>(this.adminOrderApiUrl, { params: httpParams });
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

  // Ví dụ API xác nhận thanh toán chuyển khoản
  confirmBankTransferPayment(orderId: number): Observable<ApiResponse<OrderResponse>> {
    return this.http.post<ApiResponse<OrderResponse>>(`${this.adminOrderApiUrl}/${orderId}/confirm-payment`, { paymentMethod: 'BANK_TRANSFER' }); // Ví dụ body
  }


}
