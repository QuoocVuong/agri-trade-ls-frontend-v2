import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, finalize, takeUntil, Subject } from 'rxjs';
import { Page } from '../../../core/models/page.model';
import { FollowUserResponse } from '../dto/response/FollowUserResponse';
import { ApiResponse, PagedApiResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Injectable({
  providedIn: 'root' // Cung cấp ở root
})
export class FollowService { // Không cần implements nữa
  private http = inject(HttpClient);
  private authService = inject(AuthService); // Inject AuthService
  private toastr = inject(ToastrService);
  private apiUrl = `${environment.apiUrl}/follows`;

  // --- Public Methods ---

  followUser(followingId: number): Observable<ApiResponse<void>> {
    // Không cần lấy user ở đây, backend sẽ tự lấy từ token
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/following/${followingId}`, {});
    // Component sẽ subscribe và xử lý thông báo/lỗi
  }

  unfollowUser(followingId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/following/${followingId}`);
  }

  getMyFollowing(page: number, size: number, sort?: string): Observable<PagedApiResponse<FollowUserResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (sort) params = params.set('sort', sort);
    return this.http.get<PagedApiResponse<FollowUserResponse>>(`${this.apiUrl}/following/my`, { params });
  }

  getMyFollowers(page: number, size: number, sort?: string): Observable<PagedApiResponse<FollowUserResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (sort) params = params.set('sort', sort);
    return this.http.get<PagedApiResponse<FollowUserResponse>>(`${this.apiUrl}/followers/my`, { params });
  }

  getFollowersPublic(userId: number, page: number, size: number, sort?: string): Observable<PagedApiResponse<FollowUserResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (sort) params = params.set('sort', sort);
    // API này có thể nằm ở public hoặc một endpoint khác tùy backend
    return this.http.get<PagedApiResponse<FollowUserResponse>>(`${environment.apiUrl}/public/users/${userId}/followers`, { params }); // Ví dụ endpoint public
  }

  isFollowing(followingId: number): Observable<boolean> {
    // API này cần trả về ApiResponse<boolean> từ backend
    return this.http.get<ApiResponse<boolean>>(`${this.apiUrl}/following/status/${followingId}`)
      .pipe(
        map(response => response.data ?? false) // Trích xuất giá trị boolean, mặc định là false nếu data null/undefined
      );
  }
}
