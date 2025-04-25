import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PagedApiResponse } from '../../../core/models/api-response.model';
import { ProductSummaryResponse } from '../dto/response/ProductSummaryResponse';
import { ProductDetailResponse } from '../dto/response/ProductDetailResponse';
import { ProductRequest } from '../dto/request/ProductRequest'; // Import request DTO
import { ProductStatus } from '../domain/product-status.enum'; // Import Enum Status

// Interface cho tham số tìm kiếm (mở rộng cho Admin)
export interface ProductSearchParams {
  keyword?: string | null;
  categoryId?: number | null;
  provinceCode?: string | null;
  status?: ProductStatus | string | null; // Thêm status
  farmerId?: number | null; // Thêm farmerId
  page?: number;
  size?: number;
  sort?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private http = inject(HttpClient);
  private publicApiUrl = `${environment.apiUrl}/public/products`;
  private farmerApiUrl = `${environment.apiUrl}/farmer/products`;
  private adminApiUrl = `${environment.apiUrl}/admin/products`;

  // --- Public APIs ---

  searchPublicProducts(params: ProductSearchParams): Observable<PagedApiResponse<ProductSummaryResponse>> {
    let httpParams = new HttpParams();
    if (params.keyword) httpParams = httpParams.set('keyword', params.keyword);
    if (params.categoryId) httpParams = httpParams.set('categoryId', params.categoryId.toString());
    if (params.provinceCode) httpParams = httpParams.set('provinceCode', params.provinceCode);
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
    if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
    if (params.sort) httpParams = httpParams.set('sort', params.sort);

    return this.http.get<PagedApiResponse<ProductSummaryResponse>>(this.publicApiUrl, { params: httpParams });
  }

  getPublicProductBySlug(slug: string): Observable<ApiResponse<ProductDetailResponse>> {
    return this.http.get<ApiResponse<ProductDetailResponse>>(`${this.publicApiUrl}/${slug}`);
  }

  getPublicProductById(id: number): Observable<ApiResponse<ProductDetailResponse>> {
    return this.http.get<ApiResponse<ProductDetailResponse>>(`${this.publicApiUrl}/id/${id}`);
  }


  // --- Farmer APIs ---

  getMyProducts(pageableParams: { page?: number, size?: number, sort?: string }): Observable<PagedApiResponse<ProductSummaryResponse>> {
    let httpParams = new HttpParams();
    if (pageableParams.page !== undefined) httpParams = httpParams.set('page', pageableParams.page.toString());
    if (pageableParams.size !== undefined) httpParams = httpParams.set('size', pageableParams.size.toString());
    if (pageableParams.sort) httpParams = httpParams.set('sort', pageableParams.sort);
    return this.http.get<PagedApiResponse<ProductSummaryResponse>>(`${this.farmerApiUrl}/me`, { params: httpParams });
  }

  getMyProductById(productId: number): Observable<ApiResponse<ProductDetailResponse>> {
    return this.http.get<ApiResponse<ProductDetailResponse>>(`${this.farmerApiUrl}/me/${productId}`);
  }

  createMyProduct(request: ProductRequest): Observable<ApiResponse<ProductDetailResponse>> {
    return this.http.post<ApiResponse<ProductDetailResponse>>(`${this.farmerApiUrl}/me`, request);
  }

  updateMyProduct(productId: number, request: ProductRequest): Observable<ApiResponse<ProductDetailResponse>> {
    return this.http.put<ApiResponse<ProductDetailResponse>>(`${this.farmerApiUrl}/me/${productId}`, request);
  }

  deleteMyProduct(productId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.farmerApiUrl}/me/${productId}`);
  }


  // --- Admin APIs ---

  getAllProductsForAdmin(params: ProductSearchParams): Observable<PagedApiResponse<ProductSummaryResponse>> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status.toString()); // Chuyển Enum thành string nếu cần
    if (params.categoryId) httpParams = httpParams.set('categoryId', params.categoryId.toString());
    if (params.farmerId) httpParams = httpParams.set('farmerId', params.farmerId.toString());
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
    if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    // Có thể thêm keyword nếu API admin hỗ trợ
    // if (params.keyword) httpParams = httpParams.set('keyword', params.keyword);

    return this.http.get<PagedApiResponse<ProductSummaryResponse>>(this.adminApiUrl + '/products', { params: httpParams }); // Endpoint của Admin
  }

  getProductByIdForAdmin(productId: number): Observable<ApiResponse<ProductDetailResponse>> {
    return this.http.get<ApiResponse<ProductDetailResponse>>(`${this.adminApiUrl}/products/${productId}`);
  }

  approveProduct(productId: number): Observable<ApiResponse<ProductDetailResponse>> {
    return this.http.post<ApiResponse<ProductDetailResponse>>(`${this.adminApiUrl}/products/${productId}/approve`, {});
  }

  rejectProduct(productId: number, reason?: string | null): Observable<ApiResponse<ProductDetailResponse>> {
    const body = reason ? { reason: reason } : {};
    return this.http.post<ApiResponse<ProductDetailResponse>>(`${this.adminApiUrl}/products/${productId}/reject`, body);
  }

  forceDeleteProduct(productId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.adminApiUrl}/products/${productId}/force`);
  }

  // Trong ProductService.ts
  getPublicProductsByFarmerId(farmerId: number, page: number, size: number, sort?: string): Observable<PagedApiResponse<ProductSummaryResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (sort) params = params.set('sort', sort);
    // Gọi API public mới
    // *** SỬA Ở ĐÂY: Xây dựng URL đúng từ environment.apiUrl ***
    const url = `${environment.apiUrl}/public/farmer/${farmerId}/products`;
    return this.http.get<PagedApiResponse<ProductSummaryResponse>>(url, { params });
  }

}
