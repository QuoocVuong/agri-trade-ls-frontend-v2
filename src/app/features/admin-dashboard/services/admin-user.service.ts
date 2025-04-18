import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PagedApiResponse } from '../../../core/models/api-response.model'; // Import Page
import { UserResponse } from '../../user-profile/dto/response/UserResponse'; // Import UserResponse
import { UserProfileResponse } from '../../user-profile/dto/response/UserProfileResponse'; // Import UserProfileResponse
import { RoleType } from '../../../common/model/role-type.enum'; // Import RoleType

@Injectable({
  providedIn: 'root' // Hoặc chỉ trong module Admin
})
export class AdminUserService {
  private http = inject(HttpClient);
  private adminUserApiUrl = `${environment.apiUrl}/admin/users`; // API quản lý user của Admin

  getAllUsers(page: number, size: number, sort?: string, role?: RoleType | string, keyword?: string): Observable<PagedApiResponse<UserResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (sort) params = params.set('sort', sort);
    if (role) params = params.set('role', role.toString()); // Thêm filter theo role
    if (keyword) params = params.set('keyword', keyword); // Thêm filter theo keyword
    return this.http.get<PagedApiResponse<UserResponse>>(this.adminUserApiUrl, { params });
  }

  getUserProfileById(userId: number): Observable<ApiResponse<UserProfileResponse>> {
    return this.http.get<ApiResponse<UserProfileResponse>>(`${this.adminUserApiUrl}/${userId}/profile`);
  }

  updateUserStatus(userId: number, isActive: boolean): Observable<ApiResponse<UserResponse>> {
    // API backend có thể nhận status qua RequestParam hoặc RequestBody
    let params = new HttpParams().set('isActive', isActive.toString());
    return this.http.put<ApiResponse<UserResponse>>(`${this.adminUserApiUrl}/${userId}/status`, {}, { params });
    // Hoặc: return this.http.put<ApiResponse<UserResponse>>(`${this.adminUserApiUrl}/${userId}/status`, { isActive });
  }

  updateUserRoles(userId: number, roles: RoleType[] | string[]): Observable<ApiResponse<UserResponse>> {
    // API backend nhận Set<RoleType> trong RequestBody
    return this.http.put<ApiResponse<UserResponse>>(`${this.adminUserApiUrl}/${userId}/roles`, roles);
  }

  // Thêm API lấy danh sách Farmer chờ duyệt nếu cần (hoặc dùng getAllUsers với filter)
  getPendingFarmers(page: number, size: number, sort?: string): Observable<PagedApiResponse<UserProfileResponse>> {
    // Giả sử có API riêng hoặc dùng filter
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('verificationStatus', 'PENDING'); // Filter theo trạng thái chờ duyệt
    if (sort) params = params.set('sort', sort);
    // Cần API backend trả về UserProfileResponse (bao gồm farmer profile)
    return this.http.get<PagedApiResponse<UserProfileResponse>>(`${environment.apiUrl}/admin/farmers`, { params }); // Ví dụ API
  }

  // Thêm API duyệt/từ chối Farmer
  approveFarmer(userId: number): Observable<ApiResponse<void>> { // Hoặc trả về FarmerProfileResponse
    return this.http.post<ApiResponse<void>>(`${environment.apiUrl}/admin/farmers/${userId}/approve`, {}); // Ví dụ API
  }

  rejectFarmer(userId: number, reason?: string | null | undefined): Observable<ApiResponse<void>> {
    const body = reason ? { reason: reason } : {};
    return this.http.post<ApiResponse<void>>(`${environment.apiUrl}/admin/farmers/${userId}/reject`, body); // Ví dụ API
  }

}
