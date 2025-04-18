import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http'; // Import HttpParams
import { Observable, map } from 'rxjs'; // Import map
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { CategoryResponse } from '../dto/response/CategoryResponse';
import { CategoryRequest } from '../dto/request/CategoryRequest'; // Import request DTO

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
    // Giả sử backend có API này hoặc bạn tự xử lý cây thành phẳng ở frontend
    return this.http.get<ApiResponse<CategoryResponse[]>>(`${this.publicApiUrl}`); // Hoặc endpoint khác
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
    // API này có thể giống getCategoryById nhưng yêu cầu quyền Admin
    // Hoặc có thể là endpoint riêng nếu cần trả về thông tin khác
    return this.http.get<ApiResponse<CategoryResponse>>(`${this.adminApiUrl}/${id}`); // Giả sử có endpoint này
  }
}
