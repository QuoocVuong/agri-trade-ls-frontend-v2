import {Component, OnInit, inject, signal, OnDestroy, AfterViewInit, ViewChild} from '@angular/core';
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

import { ChartConfiguration, ChartOptions, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';



@Component({
  selector: 'app-farmer-stats',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent, AlertComponent, DecimalPipe, DatePipe, RouterLink, FormatBigDecimalPipe, BaseChartDirective ],
  templateUrl: './farmer-stats.component.html',
})
export class FarmerStatsComponent implements OnInit, OnDestroy, AfterViewInit {
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

  // ****** KHAI BÁO CHO CHART.JS ******
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective; // Tham chiếu đến directive của chart



  isLoadingChart = signal(true);



  // --- Cấu hình chung cho biểu đồ đường ---
  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false, // Cho phép biểu đồ fill container
    scales: {
      x: {
        grid: {
          color: 'rgba(200, 200, 200, 0.2)' // Màu lưới trục X nhạt hơn
        },
        ticks: {
          color: '#9ca3af', // Màu chữ trục X (Tailwind gray-400)
          maxRotation: 70, // Xoay label nếu cần
          minRotation: 45
        }
      },
      y: {
        beginAtZero: true, // Bắt đầu trục Y từ 0
        grid: {
          color: 'rgba(200, 200, 200, 0.2)' // Màu lưới trục Y nhạt hơn
        },
        ticks: {
          color: '#9ca3af' // Màu chữ trục Y
        }
      }
    },
    plugins: {
      legend: {
        display: true, // Hiển thị chú giải
        position: 'top',
        labels: {
          color: '#d1d5db' // Màu chữ chú giải (Tailwind gray-300)
        }
      },
      tooltip: { // Tùy chỉnh tooltip
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        padding: 10,
        cornerRadius: 4,
      }
    },
    elements: {
      line: {
        tension: 0.3 // Làm mượt đường line
      },
      point: {
        radius: 3, // Kích thước điểm
        hoverRadius: 5
      }
    }
  };
  public lineChartLegend = true;
  public lineChartType: 'line' = 'line';

  // --- Dữ liệu riêng cho từng biểu đồ ---
  public revenueChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Doanh thu (VNĐ)',
        fill: true, // Tô màu vùng dưới đường line
        borderColor: 'rgb(59, 130, 246)', // Màu xanh dương (Tailwind blue-500)
        backgroundColor: 'rgba(59, 130, 246, 0.2)', // Màu nền nhạt hơn
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointHoverBorderColor: 'rgba(59, 130, 246, 0.8)'
      }
    ]
  };

  public orderCountChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Số đơn hàng',
        fill: true,
        borderColor: 'rgb(34, 197, 94)', // Màu xanh lá (Tailwind green-500)
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        pointBackgroundColor: 'rgb(34, 197, 94)',
        pointHoverBorderColor: 'rgba(34, 197, 94, 0.8)'
      }
    ]
  };
  // ***********************************



  ngOnInit(): void {
    this.loadAllData();
    this.loadChartData(); // Gọi hàm load dữ liệu chart
  }

  ngAfterViewInit(): void {
    // Có thể để trống hoặc thêm logic nếu cần chạy sau khi view đã khởi tạo
    // Ví dụ: Cập nhật lại biểu đồ nếu kích thước ban đầu không đúng
    // setTimeout(() => this.chart?.update(), 0);
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
    const endDate = LocalDate.now();
    const startDate = endDate.minusDays(29);

    forkJoin({
      revenue: this.dashboardService.getDailyRevenueForFarmerChart(startDate.toString(), endDate.toString()),
      count: this.dashboardService.getDailyOrderCountForFarmerChart(startDate.toString(), endDate.toString())
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingChart.set(false))
      )
      .subscribe({
        next: ({ revenue, count }) => {
          const labels: string[] = [];
          const revenueValues: number[] = [];
          const countValues: number[] = [];
          const dateMapRevenue = new Map<string, number>();
          const dateMapCount = new Map<string, number>();

          // ****** XỬ LÝ DỮ LIỆU TRỰC TIẾP ******
          if (revenue.success && revenue.data) {
            revenue.data.forEach(point => {
              if (point.label) {
                let numericValue: number;
                if (point.value instanceof BigDecimal) numericValue = Number(point.value.getValue());
                else if (typeof point.value === 'string') numericValue = parseFloat(point.value) || 0;
                else numericValue = point.value || 0;
                dateMapRevenue.set(point.label, numericValue);
              }
            });
          }
          if (count.success && count.data) {
            count.data.forEach(point => {
              if (point.label) dateMapCount.set(point.label, point.value ?? 0);
            });
          }

          for (let i = 0; i < 30; i++) {
            const currentDate = startDate.plusDays(i);
            const dateString = currentDate.toString();
            labels.push(dateString); // Hoặc format MM-DD: currentDate.format('MM-dd')
            revenueValues.push(dateMapRevenue.get(dateString) ?? 0);
            countValues.push(dateMapCount.get(dateString) ?? 0);
          }

          // Cập nhật dữ liệu cho biểu đồ doanh thu
          this.revenueChartData.labels = labels;
          this.revenueChartData.datasets[0].data = revenueValues;

          // Cập nhật dữ liệu cho biểu đồ số đơn hàng
          this.orderCountChartData.labels = labels;
          this.orderCountChartData.datasets[0].data = countValues;

          // Trigger update cho biểu đồ
          this.chart?.update();
          // *****************************************
        },
        error: (err) => {
          // Reset dữ liệu chart khi có lỗi
          this.revenueChartData.labels = [];
          this.revenueChartData.datasets[0].data = [];
          this.orderCountChartData.labels = [];
          this.orderCountChartData.datasets[0].data = [];
          this.chart?.update(); // Cập nhật để xóa biểu đồ cũ
          this.handleError(err, 'Lỗi tải dữ liệu biểu đồ');
        }
      });
  }








  trackOrderById(index: number, item: OrderSummaryResponse): number { return item.id; }
  trackProductById(index: number, item: TopProductResponse): number { return item.productId; }

  protected readonly getOrderStatusCssClass = getOrderStatusCssClass;
}
