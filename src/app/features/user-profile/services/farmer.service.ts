// src/app/features/farmer-profile/services/farmer.service.ts
// (Hoặc đặt trong core/services nếu phù hợp)

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model'; // Import ApiResponse
import { FarmerSummaryResponse } from '../dto/response/FarmerSummaryResponse';
import {Page} from '../../../core/models/page.model'; // Import DTO mới tạo

@Injectable({
  providedIn: 'root'
})
export class FarmerService {
  private http = inject(HttpClient);
  // Giả sử có một endpoint public để lấy thông tin farmers
  private publicFarmerApiUrl = `${environment.apiUrl}/public/farmers`;

  /**
   * Lấy danh sách nông dân nổi bật (ví dụ cho trang chủ).
   * Backend API cần hỗ trợ tham số limit hoặc có endpoint riêng.
   * Ví dụ gọi API: GET /api/public/farmers/featured?limit=4
   * Hoặc:         GET /api/public/farmers?isFeatured=true&limit=4&sort=rating,desc
   * @param params Đối tượng chứa tham số, ví dụ { limit: 4 }
   */
  getFeaturedFarmers(params?: { limit?: number }): Observable<ApiResponse<FarmerSummaryResponse[]>> {
    let httpParams = new HttpParams();
    if (params?.limit !== undefined) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    // Thêm các tham số khác nếu API backend yêu cầu (ví dụ: isFeatured=true, sort=...)
    // httpParams = httpParams.set('isFeatured', 'true');
    // httpParams = httpParams.set('sort', 'rating,desc'); // Ví dụ

    // Gọi API backend - URL có thể cần điều chỉnh cho đúng endpoint lấy featured farmers
    // Ví dụ dùng endpoint /featured
    return this.http.get<ApiResponse<FarmerSummaryResponse[]>>(`${this.publicFarmerApiUrl}/featured`, { params: httpParams });
    // Hoặc nếu dùng tham số query:
    // return this.http.get<ApiResponse<FarmerSummaryResponse[]>>(this.publicFarmerApiUrl, { params: httpParams });
  }

  /**
   * (Ví dụ) Lấy danh sách tất cả nông dân có phân trang (cho trang danh sách nông dân)
   * Gọi API: GET /api/public/farmers?page=...&size=...&sort=...&provinceCode=...&keyword=...
   */
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

    // Backend cần API hỗ trợ các tham số này và trả về dạng Page
    // return this.http.get<ApiResponse<Page<FarmerSummaryResponse>>>(this.publicFarmerApiUrl, { params: httpParams });
    // Tạm thời trả về lỗi vì chưa chắc có API này
    throw new Error('searchPublicFarmers API endpoint not implemented in backend yet.');
  }

  // Các phương thức khác liên quan đến farmer (public) có thể thêm vào đây...
}
