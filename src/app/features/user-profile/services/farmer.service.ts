// src/app/features/farmer-profile/services/farmer.service.ts
// (Hoặc đặt trong core/services nếu phù hợp)

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { FarmerSummaryResponse } from '../dto/response/FarmerSummaryResponse';
import {Page} from '../../../core/models/page.model';

@Injectable({
  providedIn: 'root'
})
export class FarmerService {
  private http = inject(HttpClient);
  // Giả sử có một endpoint public để lấy thông tin farmers
  private publicFarmerApiUrl = `${environment.apiUrl}/public/farmers`;


  getFeaturedFarmers(params?: { limit?: number }): Observable<ApiResponse<FarmerSummaryResponse[]>> {
    let httpParams = new HttpParams();
    if (params?.limit !== undefined) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }

    return this.http.get<ApiResponse<FarmerSummaryResponse[]>>(`${this.publicFarmerApiUrl}/featured`, { params: httpParams });

  }

  searchPublicFarmers(params: {
    page?: number,
    size?: number,
    sort?: string,
    provinceCode?: string | null,
    keyword?: string | null
  }): Observable<ApiResponse<Page<FarmerSummaryResponse>>> { // Giả sử trả về Page
    let httpParams = new HttpParams();
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
    if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    if (params.provinceCode) httpParams = httpParams.set('provinceCode', params.provinceCode);
    if (params.keyword) httpParams = httpParams.set('keyword', params.keyword);


     return this.http.get<ApiResponse<Page<FarmerSummaryResponse>>>(this.publicFarmerApiUrl, { params: httpParams });

  }

}
