import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../../user-profile/services/DashboardService'; // Sử dụng DashboardService chung
import { DashboardStatsResponse } from '../../../user-profile/dto/response/DashboardStatsResponse';
import { OrderSummaryResponse } from '../../../ordering/dto/response/OrderSummaryResponse';
import { TopProductResponse } from '../../../catalog/dto/response/TopProductResponse';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import {forkJoin, Subject} from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
// Import các hàm helper cho trạng thái đơn hàng
import { OrderStatus, getOrderStatusText, getOrderStatusCssClass } from '../../../ordering/domain/order-status.enum';
import { PaymentStatus, getPaymentStatusText, getPaymentStatusCssClass } from '../../../ordering/domain/payment-status.enum';
import {FormatBigDecimalPipe} from '../../../../shared/pipes/format-big-decimal.pipe';
import {HttpErrorResponse} from '@angular/common/http';
import {ToastrService} from 'ngx-toastr';
import {NgxChartsModule} from '@swimlane/ngx-charts';
import BigDecimal from 'js-big-decimal';
import {TimeSeriesDataPoint} from '../../../user-profile/dto/response/TimeSeriesDataPoint';
import {LocalDate} from '@js-joda/core';


@Component({
  selector: 'app-farmer-stats',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent, AlertComponent, DecimalPipe, DatePipe, RouterLink, FormatBigDecimalPipe, NgxChartsModule],
  templateUrl: './farmer-stats.component.html',
})
export class FarmerStatsComponent implements OnInit, OnDestroy {
  private dashboardService = inject(DashboardService);
  private destroy$ = new Subject<void>();
  private toastr = inject(ToastrService);

  stats = signal<DashboardStatsResponse | null>(null);
  recentOrders = signal<OrderSummaryResponse[]>([]);
  topProducts = signal<TopProductResponse[]>([]);

  isLoadingStats = signal(true);
  isLoadingOrders = signal(true);
  isLoadingProducts = signal(true);
  errorMessage = signal<string | null>(null);

  // Đưa các hàm helper vào component để template sử dụng
  getStatusText = getOrderStatusText;
  getStatusClass = getOrderStatusCssClass;
  getPaymentStatusText = getPaymentStatusText;
  getPaymentStatusClass = getPaymentStatusCssClass;


  // Signals cho dữ liệu chart
  revenueChartData = signal<any[]>([]); // Dữ liệu cho ngx-charts [{ name: "Doanh thu", series: [...] }]
  orderCountChartData = signal<any[]>([]);
  isLoadingChart = signal(true);

  // Cấu hình biểu đồ (ví dụ)
  view: [number, number] = [700, 300]; // Kích thước [width, height] - sẽ bị ghi đè bởi responsive container
  showXAxis = true;
  showYAxis = true;
  gradient = false;
  showLegend = false;
  showXAxisLabel = true;
  xAxisLabel = 'Ngày';
  showYAxisLabel = true;
  yAxisLabelRevenue = 'Doanh thu (VNĐ)';
  yAxisLabelCount = 'Số đơn hàng';
  timeline = true; // Cho phép zoom/pan theo trục thời gian
  colorScheme: any = { // Hoặc dùng string tên scheme 'vivid', 'natural'...
    domain: ['#5AA454', '#E44D25', '#CFC0BB', '#7aa3e5', '#a8385d', '#aae3f5'] // Màu tùy chỉnh
  };
  yAxisTickFormatting = (val: any) => { // Hàm format trục Y an toàn hơn
    if (typeof val === 'number') {
      return val.toLocaleString('vi-VN');
    }
    if (val instanceof BigDecimal) {
      return Number(val.toString()).toLocaleString('vi-VN');
    }
    return val;
  }; // Format trục Y tiền tệ VNĐ


  ngOnInit(): void {
    this.loadAllData();
    this.loadChartData(); // Gọi hàm load dữ liệu chart
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAllData(): void {
    this.loadStats();
    this.loadRecentOrders();
    this.loadTopProducts();
  }

  loadStats(): void {
    this.isLoadingStats.set(true);
    this.errorMessage.set(null);
    this.dashboardService.getFarmerDashboardStats()
      .pipe(takeUntil(this.destroy$), finalize(() => this.isLoadingStats.set(false)))
      .subscribe({
        next: (res: ApiResponse<DashboardStatsResponse>) => { // Thêm kiểu cho res
          if (res.success) { // Kiểm tra success trước khi set data
            // *** Sử dụng ?? để chuyển undefined thành null ***
            this.stats.set(res.data ?? null);
          } else {
            // Nếu API trả về success=false nhưng không có lỗi HTTP, vẫn set là null
            this.stats.set(null);
            this.handleError(res, 'Không tải được thống kê.'); // Hiển thị lỗi từ message
          }
        },
        error: (err) => this.handleError(err, 'Lỗi tải thống kê chung')
      });
  }

  // Cập nhật tương tự cho loadRecentOrders và loadTopProducts nếu cần
  loadRecentOrders(): void {
    this.isLoadingOrders.set(true);
    this.dashboardService.getRecentFarmerOrders(5)
      .pipe(takeUntil(this.destroy$), finalize(() => this.isLoadingOrders.set(false)))
      .subscribe({
        next: (res: ApiResponse<OrderSummaryResponse[]>) => { // Thêm kiểu
          if(res.success) {
            this.recentOrders.set(res.data ?? []); // Mặc định là mảng rỗng nếu data là null/undefined
          } else {
            this.recentOrders.set([]);
            this.handleError(res, 'Lỗi tải đơn hàng gần đây');
          }
        },
        error: (err) => this.handleError(err, 'Lỗi tải đơn hàng gần đây')
      });
  }
  loadTopProducts(): void {
    this.isLoadingProducts.set(true);
    this.dashboardService.getTopSellingFarmerProducts(5)
      .pipe(takeUntil(this.destroy$), finalize(() => this.isLoadingProducts.set(false)))
      .subscribe({
        next: (res: ApiResponse<TopProductResponse[]>) => { // Thêm kiểu
          if(res.success) {
            this.topProducts.set(res.data ?? []); // Mặc định là mảng rỗng
          } else {
            this.topProducts.set([]);
            this.handleError(res, 'Lỗi tải sản phẩm bán chạy');
          }
        },
        error: (err) => this.handleError(err, 'Lỗi tải sản phẩm bán chạy')
      });
  }

  // Hàm handleError cũng nên nhận kiểu cụ thể hơn nếu có thể
  private handleError(err: ApiResponse<any> | HttpErrorResponse | any, defaultMessage: string): void { // Thêm HttpErrorResponse
    const message = err?.message || defaultMessage;
    if (!this.errorMessage()) { // Chỉ set lỗi đầu tiên gặp phải
      this.errorMessage.set(message);
    }
    this.toastr.error(message);
    this.isLoadingStats.set(false);
    this.isLoadingOrders.set(false);
    this.isLoadingProducts.set(false);
    console.error(err);
  }

  loadChartData(): void {
    this.isLoadingChart.set(true);
    const endDate = LocalDate.now(); // Ngày hiện tại
    const startDate = endDate.minusDays(29); // Lấy dữ liệu 30 ngày gần nhất

    // Gọi API đúng cho Farmer
    forkJoin({
      revenue: this.dashboardService.getDailyRevenueForFarmerChart(startDate.toString(), endDate.toString()),
      count: this.dashboardService.getDailyOrderCountForFarmerChart(startDate.toString(), endDate.toString())
    })
    .pipe(takeUntil(this.destroy$), finalize(() => this.isLoadingChart.set(false)))
    .subscribe({
        next: ({ revenue, count }) => {
            if (revenue.success && revenue.data) {
              // *** Gọi hàm format riêng cho revenue ***
              this.revenueChartData.set([{ name: "Doanh thu", series: this.formatRevenueChartData(revenue.data) }]);
            }
             if (count.success && count.data) {
               // *** Gọi hàm format riêng cho count ***
               this.orderCountChartData.set([{ name: "Số đơn hàng", series: this.formatOrderCountChartData(count.data) }]);
            }
        },
        error: (err) => this.handleError(err, 'Lỗi tải dữ liệu biểu đồ')
    });


    // *** Tạm thời dùng dữ liệu giả ***
    // setTimeout(() => {
    //   this.revenueChartData.set([{ name: "Doanh thu", series: this.generateFakeChartData(startDate, endDate, 10000, 500000) }]);
    //   this.orderCountChartData.set([{ name: "Số đơn hàng", series: this.generateFakeChartData(startDate, endDate, 0, 10) }]);
    //   this.isLoadingChart.set(false);
    // }, 1500);
  }
  // *** Hàm format riêng cho dữ liệu doanh thu (T có thể là number | string | BigDecimal) ***
  private formatRevenueChartData(data: TimeSeriesDataPoint<BigDecimal | number | string>[]): { name: string, value: number }[] {
    return data.map(point => {
      let numericValue: number;
      if (point.value instanceof BigDecimal) {
        numericValue = Number(point.value.toString());
      } else if (typeof point.value === 'string') {
        numericValue = parseFloat(point.value) || 0; // Parse string thành số
      } else {
        numericValue = point.value || 0; // Giữ nguyên nếu là number
      }
      return {
        name: point.date.toString(),
        value: numericValue
      };
    }).filter(item => !isNaN(item.value)); // Lọc bỏ giá trị không hợp lệ
  }


  // *** Hàm format riêng cho dữ liệu số lượng (T là number) ***
  private formatOrderCountChartData(data: TimeSeriesDataPoint<number>[]): { name: string, value: number }[] {
    return data.map(point => ({
      name: point.date.toString(),
      value: point.value ?? 0 // Đảm bảo value là number
    }));
  }




  trackOrderById(index: number, item: OrderSummaryResponse): number { return item.id; }
  trackProductById(index: number, item: TopProductResponse): number { return item.productId; }
}
