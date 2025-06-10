import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PagedApiResponse, } from '../../../core/models/api-response.model';
import { DashboardStatsResponse } from '../dto/response/DashboardStatsResponse';
import { OrderSummaryResponse } from '../../ordering/dto/response/OrderSummaryResponse';
import { TopProductResponse } from '../../catalog/dto/response/TopProductResponse';
import { RecentActivityResponse } from '../dto/response/RecentActivityResponse';
import { TimeSeriesDataPoint } from '../dto/response/TimeSeriesDataPoint';
import  BigDecimal  from 'js-big-decimal'; // Import nếu dùng
import { LocalDate } from '@js-joda/core';
import {UserResponse} from '../dto/response/UserResponse';
import {FarmerSummaryResponse} from '../dto/response/FarmerSummaryResponse'; // Import nếu dùng JS Joda

@Injectable({
  providedIn: 'root' // Cung cấp ở root để Admin/Farmer đều dùng được
})
export class DashboardService { // Không implements interface nào
  private http = inject(HttpClient);
  private farmerApiUrl = `${environment.apiUrl}/farmer/dashboard`; // API dashboard của Farmer
  private adminApiUrl = `${environment.apiUrl}/admin/dashboard`;   // API dashboard của Admin

  // --- Farmer Dashboard Methods ---

  /** Lấy thống kê cho dashboard của Farmer hiện tại */
  getFarmerDashboardStats(): Observable<ApiResponse<DashboardStatsResponse>> {
    return this.http.get<ApiResponse<DashboardStatsResponse>>(`${this.farmerApiUrl}/stats`);
  }

  /** Lấy danh sách đơn hàng gần đây cho Farmer */
  getRecentFarmerOrders(limit: number): Observable<ApiResponse<OrderSummaryResponse[]>> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<ApiResponse<OrderSummaryResponse[]>>(`${this.farmerApiUrl}/recent-orders`, { params });
  }

  /** Lấy sản phẩm bán chạy nhất của Farmer */
  getTopSellingFarmerProducts(limit: number): Observable<ApiResponse<TopProductResponse[]>> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<ApiResponse<TopProductResponse[]>>(`${this.farmerApiUrl}/top-products`, { params });
  }

  /** Lấy dữ liệu doanh thu theo ngày cho biểu đồ Farmer */ // *** THÊM MỚI ***
  getDailyRevenueForFarmerChart(startDate: LocalDate | string, endDate: LocalDate | string): Observable<ApiResponse<TimeSeriesDataPoint<BigDecimal | number | string>[]>> {
    const params = new HttpParams()
      .set('startDate', startDate.toString())
      .set('endDate', endDate.toString());
    // Gọi API riêng của Farmer
    return this.http.get<ApiResponse<TimeSeriesDataPoint<BigDecimal | number | string>[]>>(`${this.farmerApiUrl}/revenue-chart`, { params });
  }

  /** Lấy dữ liệu số lượng đơn hàng theo ngày cho biểu đồ Farmer */ // *** THÊM MỚI ***
  getDailyOrderCountForFarmerChart(startDate: LocalDate | string, endDate: LocalDate | string): Observable<ApiResponse<TimeSeriesDataPoint<number>[]>> {
    const params = new HttpParams()
      .set('startDate', startDate.toString())
      .set('endDate', endDate.toString());
    // Gọi API riêng của Farmer
    return this.http.get<ApiResponse<TimeSeriesDataPoint<number>[]>>(`${this.farmerApiUrl}/order-count-chart`, { params });
  }

  // --- Admin Dashboard Methods ---

  /** Lấy thống kê tổng quan cho dashboard Admin */
  getAdminDashboardStats(): Observable<ApiResponse<DashboardStatsResponse>> {
    return this.http.get<ApiResponse<DashboardStatsResponse>>(`${this.adminApiUrl}/stats`);
  }

  /** Lấy dữ liệu doanh thu theo ngày cho biểu đồ Admin */
  getDailyRevenueForAdminChart(startDate: LocalDate | string, endDate: LocalDate | string): Observable<ApiResponse<TimeSeriesDataPoint<BigDecimal | number | string>[]>> {
    const params = new HttpParams()
      .set('startDate', startDate.toString()) // Chuyển LocalDate thành string YYYY-MM-DD
      .set('endDate', endDate.toString());
    return this.http.get<ApiResponse<TimeSeriesDataPoint<BigDecimal | number | string>[]>>(`${this.adminApiUrl}/revenue-chart`, { params });
  }

  /** Lấy dữ liệu số lượng đơn hàng theo ngày cho biểu đồ Admin */
  getDailyOrderCountForAdminChart(startDate: LocalDate | string, endDate: LocalDate | string): Observable<ApiResponse<TimeSeriesDataPoint<number>[]>> {
    const params = new HttpParams()
      .set('startDate', startDate.toString())
      .set('endDate', endDate.toString());
    return this.http.get<ApiResponse<TimeSeriesDataPoint<number>[]>>(`${this.adminApiUrl}/order-count-chart`, { params });
  }

  /** Lấy danh sách các hoạt động gần đây cho Admin */
  getRecentActivitiesForAdmin(limit: number): Observable<ApiResponse<RecentActivityResponse[]>> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<ApiResponse<RecentActivityResponse[]>>(`${this.adminApiUrl}/recent-activities`, { params });
  }

  /** Lấy số lượng các mục chờ duyệt */
  getPendingApprovalCounts(): Observable<ApiResponse<{[key: string]: number}>> {
    // Backend API cần trả về Map hoặc một cấu trúc tương đương
    return this.http.get<ApiResponse<{[key: string]: number}>>(`${this.adminApiUrl}/pending-approvals`);
  }

  // Thêm các phương thức mới


  getTopPerformingFarmers(limit: number): Observable<ApiResponse<FarmerSummaryResponse[]>> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<ApiResponse<FarmerSummaryResponse[]>>(`${this.adminApiUrl}/top-farmers`, { params });
  }

  getTopSpendingBuyers(limit: number): Observable<ApiResponse<UserResponse[]>> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<ApiResponse<UserResponse[]>>(`${this.adminApiUrl}/top-buyers`, { params });
  }

  getDailyUserRegistrations(startDate: LocalDate, endDate: LocalDate): Observable<ApiResponse<TimeSeriesDataPoint<number>[]>> {
    const params = new HttpParams()
      .set('startDate', startDate.toString())
      .set('endDate', endDate.toString());
    return this.http.get<ApiResponse<TimeSeriesDataPoint<number>[]>>(`${this.adminApiUrl}/user-growth-chart`, { params });
  }
}
