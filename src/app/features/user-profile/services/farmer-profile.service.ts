import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment'; // Import environment
import { ApiResponse } from '../../../core/models/api-response.model'; // Import ApiResponse
import { FarmerProfileResponse } from '../dto/response/FarmerProfileResponse'; // Import DTO Response
import { FarmerProfileRequest } from '../dto/request/FarmerProfileRequest'; // Import DTO Request (nếu cần update)

@Injectable({
  providedIn: 'root' // Cung cấp service ở root injector
})
export class FarmerProfileService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/profiles/farmer`; // Base URL cho API farmer profile
  private adminApiUrl = `${environment.apiUrl}/admin/profiles/farmer`; // Nếu có API admin riêng

  /**
   * Lấy thông tin public profile của một farmer theo User ID.
   * Gọi API: GET /api/profiles/farmer/{userId}
   */
  getFarmerProfile(userId: number): Observable<ApiResponse<FarmerProfileResponse>> {
    return this.http.get<ApiResponse<FarmerProfileResponse>>(`${this.apiUrl}/${userId}`);
  }

  /**
   * Farmer tự tạo hoặc cập nhật profile của mình.
   * Gọi API: PUT /api/profiles/farmer/me
   */
  createOrUpdateMyProfile(request: FarmerProfileRequest): Observable<ApiResponse<FarmerProfileResponse>> {
    return this.http.put<ApiResponse<FarmerProfileResponse>>(`${this.apiUrl}/me`, request);
  }

  // --- Các phương thức cho Admin (Ví dụ) ---

  /**
   * Admin duyệt profile farmer.
   * Gọi API: POST /api/admin/profiles/farmer/{userId}/approve
   */
  approveFarmerProfile(userId: number): Observable<ApiResponse<void>> { // Hoặc trả về FarmerProfileResponse đã duyệt
    return this.http.post<ApiResponse<void>>(`${this.adminApiUrl}/${userId}/approve`, {});
  }

  /**
   * Admin từ chối profile farmer.
   * Gọi API: POST /api/admin/profiles/farmer/{userId}/reject
   */
  rejectFarmerProfile(userId: number, reason: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.adminApiUrl}/${userId}/reject`, { reason });
  }

  // Thêm các phương thức khác nếu cần...
}
