import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PagedApiResponse } from '../../../core/models/api-response.model';
import { CategoryResponse } from '../../catalog/dto/response/CategoryResponse';
import { CategoryRequest } from '../../catalog/dto/request/CategoryRequest';
import { ProductSummaryResponse } from '../../catalog/dto/response/ProductSummaryResponse';
import { ProductDetailResponse } from '../../catalog/dto/response/ProductDetailResponse';
import { ProductStatus } from '../../catalog/domain/product-status.enum';
import { ProductRejectRequest } from '../../catalog/dto/request/ProductRejectRequest';

@Injectable({
  providedIn: 'root'
})
export class AdminCatalogService {
  private http = inject(HttpClient);
  private adminCatApiUrl = `${environment.apiUrl}/admin/categories`;
  private adminProdApiUrl = `${environment.apiUrl}/admin/products`;

  // --- Category Admin APIs ---
  createCategory(request: CategoryRequest): Observable<ApiResponse<CategoryResponse>> {
    return this.http.post<ApiResponse<CategoryResponse>>(this.adminCatApiUrl, request);
  }

  updateCategory(id: number, request: CategoryRequest): Observable<ApiResponse<CategoryResponse>> {
    return this.http.put<ApiResponse<CategoryResponse>>(`${this.adminCatApiUrl}/${id}`, request);
  }

  deleteCategory(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.adminCatApiUrl}/${id}`);
  }

  getCategoryByIdForAdmin(id: number): Observable<ApiResponse<CategoryResponse>> {

    return this.http.get<ApiResponse<CategoryResponse>>(`${this.adminCatApiUrl}/${id}`);
  }

  getAllCategoriesForAdmin(page: number, size: number, sort?: string, keyword?: string): Observable<PagedApiResponse<CategoryResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (sort) params = params.set('sort', sort);
    if (keyword) params = params.set('keyword', keyword);

    return this.http.get<PagedApiResponse<CategoryResponse>>(this.adminCatApiUrl, { params });
  }

  // --- Product Admin APIs ---
  getAllProductsForAdmin(params: { status?: ProductStatus | string | null, categoryId?: number | null, farmerId?: number | null, keyword?: string | null, page?: number, size?: number, sort?: string }): Observable<PagedApiResponse<ProductSummaryResponse>> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status.toString());
    if (params.categoryId) httpParams = httpParams.set('categoryId', params.categoryId.toString());
    if (params.farmerId) httpParams = httpParams.set('farmerId', params.farmerId.toString());
    if (params.keyword) httpParams = httpParams.set('keyword', params.keyword); // Thêm keyword
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
    if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
    if (params.sort) httpParams = httpParams.set('sort', params.sort);

    return this.http.get<PagedApiResponse<ProductSummaryResponse>>(this.adminProdApiUrl, { params: httpParams }); // Endpoint của Admin
  }

  getProductByIdForAdmin(productId: number): Observable<ApiResponse<ProductDetailResponse>> {
    return this.http.get<ApiResponse<ProductDetailResponse>>(`${this.adminProdApiUrl}/${productId}`);
  }

  approveProduct(productId: number): Observable<ApiResponse<ProductDetailResponse>> {
    return this.http.post<ApiResponse<ProductDetailResponse>>(`${this.adminProdApiUrl}/${productId}/approve`, {});
  }

  rejectProduct(productId: number, reason?: string | null): Observable<ApiResponse<ProductDetailResponse>> {
    const body: ProductRejectRequest = {}; // Sử dụng DTO
    if (reason) {
      body.reason = reason;
    }
    return this.http.post<ApiResponse<ProductDetailResponse>>(`${this.adminProdApiUrl}/${productId}/reject`, body);
  }

  forceDeleteProduct(productId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.adminProdApiUrl}/${productId}/force`);
  }
}
