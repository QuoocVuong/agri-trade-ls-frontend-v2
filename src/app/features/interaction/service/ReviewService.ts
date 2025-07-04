import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PagedApiResponse } from '../../../core/models/api-response.model';
import { ReviewResponse } from '../dto/response/ReviewResponse';
import { ReviewRequest } from '../dto/request/ReviewRequest';
import { ReviewStatus } from '../../../common/model/review-status.enum';

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/reviews`; // Base URL cho API review

  private farmerReviewApiUrl = `${environment.apiUrl}/farmer/reviews`;

  // Tạo review mới
  createReview(request: ReviewRequest): Observable<ApiResponse<ReviewResponse>> {
    return this.http.post<ApiResponse<ReviewResponse>>(this.apiUrl, request);
  }

  // Lấy review đã duyệt của sản phẩm (phân trang)
  getApprovedReviewsByProduct(productId: number, page: number, size: number, sort?: string): Observable<PagedApiResponse<ReviewResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (sort) {
      params = params.set('sort', sort);
    }

    return this.http.get<PagedApiResponse<ReviewResponse>>(`${environment.apiUrl}/reviews/product/${productId}`, { params });

  }

  // Lấy review của user hiện tại (phân trang)
  getMyReviews(page: number, size: number, sort?: string): Observable<PagedApiResponse<ReviewResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (sort) {
      params = params.set('sort', sort);
    }
    return this.http.get<PagedApiResponse<ReviewResponse>>(`${this.apiUrl}/my`, { params });
  }

  // --- Admin APIs ---
  getReviewsByStatus(status: ReviewStatus, page: number, size: number, sort?: string): Observable<PagedApiResponse<ReviewResponse>> {
    let params = new HttpParams()
      .set('status', status)
      .set('page', page.toString())
      .set('size', size.toString());
    if (sort) {
      params = params.set('sort', sort);
    }
    return this.http.get<PagedApiResponse<ReviewResponse>>(`${environment.apiUrl}/admin/reviews`, { params }); // API Admin
  }

  approveReview(reviewId: number): Observable<ApiResponse<ReviewResponse>> {
    return this.http.post<ApiResponse<ReviewResponse>>(`${environment.apiUrl}/admin/reviews/${reviewId}/approve`, {});
  }

  rejectReview(reviewId: number): Observable<ApiResponse<ReviewResponse>> {
    return this.http.post<ApiResponse<ReviewResponse>>(`${environment.apiUrl}/admin/reviews/${reviewId}/reject`, {});
  }

  deleteReview(reviewId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${environment.apiUrl}/admin/reviews/${reviewId}`);
  }

  getReviewsForMyProducts(page: number, size: number, sort?: string, status?: ReviewStatus | null): Observable<PagedApiResponse<ReviewResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (sort) {
      params = params.set('sort', sort);
    }

    return this.http.get<PagedApiResponse<ReviewResponse>>(this.farmerReviewApiUrl, { params });
  }
}
