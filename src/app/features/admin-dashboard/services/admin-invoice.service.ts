// src/app/features/admin-dashboard/services/admin-invoice.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedApiResponse } from '../../../core/models/api-response.model';

import {InvoiceSummaryResponse} from '../../ordering/dto/response/InvoiceSummaryResponse';
import {InvoiceStatus} from '../../ordering/domain/invoice-status.enum';
import {PaymentStatus} from '../../ordering/domain/payment-status.enum';


export interface AdminInvoiceSearchParams {
  page?: number;
  size?: number;
  sort?: string;
  keyword?: string | null;
  status?: InvoiceStatus | string | null;
  paymentStatus?: PaymentStatus | string | null;
}
export interface FarmerInvoiceSearchParams {
  page?: number;
  size?: number;
  sort?: string;
  keyword?: string | null; // Tìm theo mã HĐ, mã ĐH, tên người mua
  status?: InvoiceStatus | string | null;
  paymentStatus?: PaymentStatus | string | null;
}
@Injectable({
  providedIn: 'root'
})
export class AdminInvoiceService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/admin/invoices`;
  // API endpoint mới cho Farmer lấy hóa đơn của họ
  private farmerApiUrl = `${environment.apiUrl}/farmer/invoices`;


  getAllInvoices(params: AdminInvoiceSearchParams): Observable<PagedApiResponse<InvoiceSummaryResponse>> {
    let httpParams = new HttpParams();
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
    if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    if (params.keyword?.trim()) httpParams = httpParams.set('keyword', params.keyword.trim());
    if (params.status) httpParams = httpParams.set('status', params.status.toString());
    if (params.paymentStatus) httpParams = httpParams.set('paymentStatus', params.paymentStatus.toString());

    console.log('AdminInvoiceService: Calling API with params:', httpParams.toString());

    return this.http.get<PagedApiResponse<InvoiceSummaryResponse>>(this.apiUrl, { params: httpParams });
  }


  getMyInvoicesAsFarmer(params: FarmerInvoiceSearchParams): Observable<PagedApiResponse<InvoiceSummaryResponse>> {
    let httpParams = new HttpParams();

    if (params.page !== undefined) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params.size !== undefined) {
      httpParams = httpParams.set('size', params.size.toString());
    }
    if (params.sort) {
      httpParams = httpParams.set('sort', params.sort);
    }
    if (params.keyword?.trim()) {
      httpParams = httpParams.set('keyword', params.keyword.trim());
    }
    if (params.status) {
      httpParams = httpParams.set('status', params.status.toString());
    }
    if (params.paymentStatus) httpParams = httpParams.set('paymentStatus', params.paymentStatus.toString());

    // Gọi API backend GET /api/farmer/invoices
    return this.http.get<PagedApiResponse<InvoiceSummaryResponse>>(this.farmerApiUrl, { params: httpParams });
  }


}
