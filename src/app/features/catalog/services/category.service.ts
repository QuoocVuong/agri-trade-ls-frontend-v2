import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { CategoryResponse } from '../dto/response/CategoryResponse';
import { CategoryRequest } from '../dto/request/CategoryRequest';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private http = inject(HttpClient);
  private publicApiUrl = `${environment.apiUrl}/public/categories`;
  private adminApiUrl = `${environment.apiUrl}/admin/categories`; // API cho Admin

  // --- Public APIs ---

  getCategoryTree(): Observable<ApiResponse<CategoryResponse[]>> {
    return this.http.get<ApiResponse<CategoryResponse[]>>(`${this.publicApiUrl}/tree`);
  }

  getCategoryBySlug(slug: string): Observable<ApiResponse<CategoryResponse>> {
    return this.http.get<ApiResponse<CategoryResponse>>(`${this.publicApiUrl}/${slug}`);
  }

  // Lấy danh sách category phẳng (không phân cấp) - có thể dùng cho dropdown chọn category
  getAllCategoriesFlat(): Observable<ApiResponse<CategoryResponse[]>> {

    return this.http.get<ApiResponse<CategoryResponse[]>>(`${this.publicApiUrl}`);
  }


  // --- Admin APIs ---

  createCategory(request: CategoryRequest): Observable<ApiResponse<CategoryResponse>> {
    return this.http.post<ApiResponse<CategoryResponse>>(this.adminApiUrl, request);
  }

  updateCategory(id: number, request: CategoryRequest): Observable<ApiResponse<CategoryResponse>> {
    return this.http.put<ApiResponse<CategoryResponse>>(`${this.adminApiUrl}/${id}`, request);
  }

  deleteCategory(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.adminApiUrl}/${id}`);
  }

  getCategoryByIdForAdmin(id: number): Observable<ApiResponse<CategoryResponse>> {

    return this.http.get<ApiResponse<CategoryResponse>>(`${this.adminApiUrl}/${id}`);
  }
}
