import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { ProductSummaryResponse } from '../../catalog/dto/response/ProductSummaryResponse';
import { ApiResponse, PagedApiResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class FavoriteService { // Không cần implements
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/favorites`;

  addFavorite(productId: number): Observable<ApiResponse<void>> {

    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/product/${productId}`, {});
  }

  removeFavorite(productId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/product/${productId}`);
  }

  getMyFavorites(page: number, size: number, sort?: string): Observable<PagedApiResponse<ProductSummaryResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (sort) params = params.set('sort', sort);
    return this.http.get<PagedApiResponse<ProductSummaryResponse>>(`${this.apiUrl}/my`, { params });
  }

  isFavorite(productId: number): Observable<boolean> {

    return this.http.get<ApiResponse<boolean>>(`${this.apiUrl}/product/${productId}/status`)
      .pipe(
        map(response => response.data ?? false)
      );
  }
}
