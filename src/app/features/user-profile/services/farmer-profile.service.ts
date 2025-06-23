import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { FarmerProfileResponse } from '../dto/response/FarmerProfileResponse';
import { FarmerProfileRequest } from '../dto/request/FarmerProfileRequest';

@Injectable({
  providedIn: 'root' // Cung cấp service ở root injector
})
export class FarmerProfileService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/profiles/farmer`; // Base URL cho API farmer profile
  private adminApiUrl = `${environment.apiUrl}/admin/profiles/farmer`; // Nếu có API admin riêng


  getFarmerProfile(userId: number): Observable<ApiResponse<FarmerProfileResponse>> {
    return this.http.get<ApiResponse<FarmerProfileResponse>>(`${this.apiUrl}/${userId}`);
  }


  createOrUpdateMyProfile(request: FarmerProfileRequest): Observable<ApiResponse<FarmerProfileResponse>> {
    return this.http.put<ApiResponse<FarmerProfileResponse>>(`${this.apiUrl}/me`, request);
  }

  // --- Các phương thức cho Admin (Ví dụ) ---


  approveFarmerProfile(userId: number): Observable<ApiResponse<void>> { // Hoặc trả về FarmerProfileResponse đã duyệt
    return this.http.post<ApiResponse<void>>(`${this.adminApiUrl}/${userId}/approve`, {});
  }


  rejectFarmerProfile(userId: number, reason: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.adminApiUrl}/${userId}/reject`, { reason });
  }


}
