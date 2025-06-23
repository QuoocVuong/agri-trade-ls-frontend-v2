import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PagedApiResponse } from '../../../core/models/api-response.model';
import { ReviewResponse } from '../../interaction/dto/response/ReviewResponse';
import { ReviewStatus } from '../../../common/model/review-status.enum';
import { RoleResponse } from '../../user-profile/dto/response/RoleResponse';
import { RoleUpdateRequest } from '../../user-profile/dto/request/RoleUpdateRequest';
import { PermissionResponse } from '../../user-profile/dto/response/PermissionResponse';

@Injectable({
  providedIn: 'root'
})
export class AdminInteractionService {
  private http = inject(HttpClient);
  private adminReviewApiUrl = `${environment.apiUrl}/admin/reviews`;
  private adminRoleApiUrl = `${environment.apiUrl}/admin/roles`;
  private adminPermissionApiUrl = `${environment.apiUrl}/admin/permissions`; // API quản lý permission

  // --- Review Admin APIs ---
  getReviewsByStatus(status: ReviewStatus, page: number, size: number, sort?: string): Observable<PagedApiResponse<ReviewResponse>> {
    let params = new HttpParams()
      .set('status', status)
      .set('page', page.toString())
      .set('size', size.toString());
    if (sort) params = params.set('sort', sort);
    return this.http.get<PagedApiResponse<ReviewResponse>>(this.adminReviewApiUrl, { params });
  }

  approveReview(reviewId: number): Observable<ApiResponse<ReviewResponse>> {
    return this.http.post<ApiResponse<ReviewResponse>>(`${this.adminReviewApiUrl}/${reviewId}/approve`, {});
  }

  rejectReview(reviewId: number): Observable<ApiResponse<ReviewResponse>> {
    return this.http.post<ApiResponse<ReviewResponse>>(`${this.adminReviewApiUrl}/${reviewId}/reject`, {});
  }

  deleteReview(reviewId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.adminReviewApiUrl}/${reviewId}`);
  }

  // --- Role & Permission Admin APIs ---
  getAllRoles(): Observable<ApiResponse<RoleResponse[]>> {
    return this.http.get<ApiResponse<RoleResponse[]>>(this.adminRoleApiUrl);
  }

  getRoleById(roleId: number): Observable<ApiResponse<RoleResponse>> {
    // API này cần trả về RoleResponse bao gồm cả permissionNames
    return this.http.get<ApiResponse<RoleResponse>>(`${this.adminRoleApiUrl}/${roleId}`);
  }

  updateRolePermissions(roleId: number, request: RoleUpdateRequest): Observable<ApiResponse<RoleResponse>> {
    // API này nhận danh sách tên permission và trả về RoleResponse đã cập nhật
    return this.http.put<ApiResponse<RoleResponse>>(`${this.adminRoleApiUrl}/${roleId}/permissions`, request);
  }

  // --- Permission Admin APIs ---
  /** Lấy danh sách tất cả các quyền hạn có trong hệ thống */
  getAllPermissions(): Observable<ApiResponse<PermissionResponse[]>> {
    // API backend cần trả về danh sách tất cả permissions có thể có
    return this.http.get<ApiResponse<PermissionResponse[]>>(this.adminPermissionApiUrl);
  }


}
