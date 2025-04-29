import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { DashboardService } from '../../../user-profile/services/DashboardService';
import { DashboardStatsResponse } from '../../../user-profile/dto/response/DashboardStatsResponse';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { RouterLink } from '@angular/router';
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';
import {ChartConfiguration, ChartData, ChartType, LineController, LineElement, PointElement, Tooltip} from 'chart.js'; // Import các kiểu dữ liệu cho biểu đồ
import { BaseChartDirective } from 'ng2-charts';
import {LocalDate} from '@js-joda/core';
import {TimeSeriesDataPoint} from '../../../user-profile/dto/response/TimeSeriesDataPoint';
import BigDecimal from 'js-big-decimal';
import {RecentActivityResponse} from '../../../user-profile/dto/response/RecentActivityResponse'; // Import directive cho biểu đồ
import { Chart, CategoryScale, LinearScale } from 'chart.js';

@Component({
  selector: 'app-admin-stats',
  standalone: true,
  imports: [
    CommonModule,
    LoadingSpinnerComponent,
    AlertComponent,
    DecimalPipe,
    RouterLink,
    FormatBigDecimalPipe,
    BaseChartDirective], // Thêm BaseChartDirective
  templateUrl: './admin-stats.component.html',
})
export class AdminStatsComponent implements OnInit {
  private dashboardService = inject(DashboardService);

  stats = signal<DashboardStatsResponse | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  recentActivities = signal<RecentActivityResponse[]>([]);

  // Cấu hình biểu đồ đường
  public lineChartData: ChartData<'line'> = {
    labels: [], // Mảng chứa các ngày
    datasets: [
      {
        data: [], // Mảng chứa doanh thu tương ứng
        label: 'Doanh thu',
        fill: false,
        tension: 0.5,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
      }
    ]
  };
  public lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    scales: {
      x: {
        type: 'category', // Đảm bảo trục x là category nếu labels là string
      },
      y: {
        beginAtZero: true, // Bắt đầu trục y từ 0
      },
    },
  };
  public lineChartType: ChartType = 'line';

  ngOnInit(): void {
    // Register all necessary Chart.js components
    Chart.register(
      CategoryScale,
      LinearScale,
      LineController,  // Register the LineController
      LineElement,    // Register LineElement for rendering lines
      PointElement,   // Register PointElement for rendering points
      Tooltip         // Register Tooltip for hover effects
    );
    this.loadStats();
    this.loadRevenueChartData(); // Gọi hàm lấy dữ liệu biểu đồ

    // Gọi hàm tải dữ liệu cho biểu đồ số lượng đơn hàng nếu bạn muốn hiển thị nó
    // this.loadOrderCountChartData();
    this.loadRecentActivities();
    this.loadPendingApprovalCounts();
  }

  loadStats(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.dashboardService.getAdminDashboardStats().subscribe({
      next: (response: ApiResponse<DashboardStatsResponse>) => {
        if (response.success && response.data) {
          this.stats.set(response.data);
        } else {
          this.errorMessage.set(response.message || 'Không thể tải dữ liệu thống kê.');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Lỗi khi tải dữ liệu thống kê.');
        this.isLoading.set(false);
        console.error(err);
      }
    });
  }

  loadRevenueChartData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const endDate = LocalDate.now();
    const startDate = endDate.minusDays(7);

    this.dashboardService.getDailyRevenueForAdminChart(startDate, endDate).subscribe({
      next: (response: ApiResponse<TimeSeriesDataPoint<BigDecimal | number | string>[]>) => {
        if (response.success && response.data) {
          this.lineChartData.labels = response.data.map(item => {
            if (typeof item.date === 'string') {
              return item.date;
            } else if (item.date instanceof LocalDate) {
              return item.date.toString();
            }
            return '';
          });
          this.lineChartData.datasets[0].data = response.data.map(item => {
            if (typeof item.value === 'object' && 'toDecimalValue' in item.value) {
              const bigDecimalValue = item.value as { toDecimalValue: () => string };
              return parseFloat(bigDecimalValue.toDecimalValue());
            }
            return item.value as number;
          });
          console.log('Dữ liệu biểu đồ doanh thu:', this.lineChartData); // Kiểm tra dữ liệu
        } else {
          this.errorMessage.set(response.message || 'Không thể tải dữ liệu doanh thu.');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Lỗi khi tải dữ liệu doanh thu.');
        this.isLoading.set(false);
        console.error(err);
      }
    });
  }


  loadOrderCountChartData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const endDate = LocalDate.now();
    const startDate = endDate.minusDays(7);

    this.dashboardService.getDailyOrderCountForAdminChart(startDate, endDate).subscribe({
      next: (response: ApiResponse<TimeSeriesDataPoint<number>[]>) => {
        if (response.success && response.data) {
          // Xử lý dữ liệu cho biểu đồ số lượng đơn hàng (nếu bạn có)
          console.log('Dữ liệu số lượng đơn hàng:', response.data);
        } else {
          this.errorMessage.set(response.message || 'Không thể tải dữ liệu số lượng đơn hàng.');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Lỗi khi tải dữ liệu số lượng đơn hàng.');
        this.isLoading.set(false);
        console.error(err);
      }
    });
  }

  loadRecentActivities(): void {
    this.dashboardService.getRecentActivitiesForAdmin(5).subscribe({
      next: (response: ApiResponse<RecentActivityResponse[]>) => {
        if (response.success && response.data) {
          this.recentActivities.set(response.data);
        } else {
          console.error('Không thể tải hoạt động gần đây:', response.message);
        }
      },
      error: (err) => {
        console.error('Lỗi khi tải hoạt động gần đây:', err);
      }
    });
  }

  loadPendingApprovalCounts(): void {
    this.dashboardService.getPendingApprovalCounts().subscribe({
      next: (response: ApiResponse<{[key: string]: number}>) => {
        if (response.success && response.data) {
          const pendingCounts = response.data as { [key: string]: number }; // Ép kiểu
          this.stats.update(currentStats => {
            if (currentStats) {
              return {
                ...currentStats,
                pendingFarmerApprovals: pendingCounts['farmers'] || 0,
                pendingProductApprovals: pendingCounts['products'] || 0,
                pendingReviews: pendingCounts['reviews'] || 0,
              };
            }
            return currentStats;
          });
        } else {
          console.error('Không thể tải số lượng chờ duyệt:', response.message);
        }
      },
      error: (err) => {
        console.error('Lỗi khi tải số lượng chờ duyệt:', err);
      }
    });
  }



}
