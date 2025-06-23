import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PagedApiResponse } from '../../../core/models/api-response.model';
import { UserResponse } from '../../user-profile/dto/response/UserResponse';
import { UserProfileResponse } from '../../user-profile/dto/response/UserProfileResponse';
import { RoleType } from '../../../common/model/role-type.enum';

@Injectable({
  providedIn: 'root'
})
export class AdminUserService {
  private http = inject(HttpClient);
  private adminUserApiUrl = `${environment.apiUrl}/users`; // API quản lý user của Admin

  getAllUsers(page: number, size: number, sort?: string, role?: RoleType | string, keyword?: string, isActive?: boolean): Observable<PagedApiResponse<UserResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (sort) params = params.set('sort', sort);
    if (role) params = params.set('role', role.toString()); // Thêm filter theo role
    if (keyword) params = params.set('keyword', keyword); // Thêm filter theo keyword
    if (isActive !== undefined) params = params.set('isActive', isActive.toString()); // Thêm isActive

    return this.http.get<PagedApiResponse<UserResponse>>(this.adminUserApiUrl, { params });
  }

  getUserProfileById(userId: number): Observable<ApiResponse<UserProfileResponse>> {
    return this.http.get<ApiResponse<UserProfileResponse>>(`${this.adminUserApiUrl}/${userId}/profile`);
  }

  updateUserStatus(userId: number, isActive: boolean): Observable<ApiResponse<UserResponse>> {

    let params = new HttpParams().set('isActive', isActive.toString());
    return this.http.put<ApiResponse<UserResponse>>(`${this.adminUserApiUrl}/${userId}/status`, {}, { params });

  }

  updateUserRoles(userId: number, roles: RoleType[] | string[]): Observable<ApiResponse<UserResponse>> {

    return this.http.put<ApiResponse<UserResponse>>(`${this.adminUserApiUrl}/${userId}/roles`, roles);
  }


  getPendingFarmers(page: number, size: number, sort?: string): Observable<PagedApiResponse<UserProfileResponse>> {

    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('verificationStatus', 'PENDING'); // Filter theo trạng thái chờ duyệt
    if (sort) params = params.set('sort', sort);

    return this.http.get<PagedApiResponse<UserProfileResponse>>(`${environment.apiUrl}/admin/farmers`, { params });
  }

  // Thêm API duyệt/từ chối Farmer
  approveFarmer(userId: number): Observable<ApiResponse<void>> { // Hoặc trả về FarmerProfileResponse
    return this.http.post<ApiResponse<void>>(`${environment.apiUrl}/admin/farmers/${userId}/approve`, {});
  }

  rejectFarmer(userId: number, reason?: string | null | undefined): Observable<ApiResponse<void>> {
    const body = reason ? { reason: reason } : {};
    return this.http.post<ApiResponse<void>>(`${environment.apiUrl}/admin/farmers/${userId}/reject`, body);
  }

}
