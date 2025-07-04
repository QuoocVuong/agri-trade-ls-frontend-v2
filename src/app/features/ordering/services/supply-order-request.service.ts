// src/app/features/ordering/services/supply-order-request.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PagedApiResponse } from '../../../core/models/api-response.model';
import { SupplyOrderPlacementRequest } from '../dto/request/SupplyOrderPlacementRequest';
import { SupplyOrderRequestResponse } from '../dto/response/SupplyOrderRequestResponse';
import { OrderResponse } from '../dto/response/OrderResponse';
import {SupplyOrderRequestStatus} from '../domain/supply-order-request-status.enum';

@Injectable({
  providedIn: 'root'
})
export class SupplyOrderRequestService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/supply-requests`;

  createSupplyOrderRequest(request: SupplyOrderPlacementRequest): Observable<ApiResponse<SupplyOrderRequestResponse>> {
    return this.http.post<ApiResponse<SupplyOrderRequestResponse>>(this.apiUrl, request);
  }

  getMySentRequests(page: number, size: number, sort?: string, status?: SupplyOrderRequestStatus | null): Observable<PagedApiResponse<SupplyOrderRequestResponse>> {
    let params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    if (sort) params = params.set('sort', sort);
    if (status) params = params.set('status', status);
    return this.http.get<PagedApiResponse<SupplyOrderRequestResponse>>(`${this.apiUrl}/my-sent`, { params });
  }

  getMyReceivedRequests(page: number, size: number, sort?: string, status?: SupplyOrderRequestStatus | null): Observable<PagedApiResponse<SupplyOrderRequestResponse>> {
    let params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    if (sort) params = params.set('sort', sort);
    if (status) params = params.set('status', status);
    return this.http.get<PagedApiResponse<SupplyOrderRequestResponse>>(`${this.apiUrl}/my-received`, { params });
  }

  getRequestDetails(requestId: number): Observable<ApiResponse<SupplyOrderRequestResponse>> {
    return this.http.get<ApiResponse<SupplyOrderRequestResponse>>(`${this.apiUrl}/${requestId}`);
  }

  acceptRequest(requestId: number): Observable<ApiResponse<OrderResponse>> {
    return this.http.post<ApiResponse<OrderResponse>>(`${this.apiUrl}/${requestId}/accept`, {});
  }

  rejectRequest(requestId: number, reason?: string): Observable<ApiResponse<SupplyOrderRequestResponse>> {
    const payload = reason ? { reason } : {};
    return this.http.post<ApiResponse<SupplyOrderRequestResponse>>(`${this.apiUrl}/${requestId}/reject`, payload);
  }
  cancelMySentRequest(requestId: number): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/${requestId}/cancel-by-buyer`, {});
  }


  checkCreateRequestPermission(): Observable<ApiResponse<void>> {
    // Backend cần có endpoint: POST /api/supply-requests/check-permission
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/check-permission`, {});
  }
}
