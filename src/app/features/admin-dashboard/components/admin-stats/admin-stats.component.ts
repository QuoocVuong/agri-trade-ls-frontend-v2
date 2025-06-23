import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { DashboardService } from '../../../user-profile/services/DashboardService';
import { DashboardStatsResponse } from '../../../user-profile/dto/response/DashboardStatsResponse';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { RouterLink } from '@angular/router';
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';
import {
  ArcElement,
  ChartConfiguration,
  ChartData,
  ChartType,
  Legend,
  LineController,
  LineElement, PieController,
  PointElement,
  Tooltip
} from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import {DateTimeFormatter, LocalDate} from '@js-joda/core';
import {TimeSeriesDataPoint} from '../../../user-profile/dto/response/TimeSeriesDataPoint';
import BigDecimal from 'js-big-decimal';
import {RecentActivityResponse} from '../../../user-profile/dto/response/RecentActivityResponse';
import { Chart, CategoryScale, LinearScale } from 'chart.js';
import {UserResponse} from '../../../user-profile/dto/response/UserResponse';
import {FarmerSummaryResponse} from '../../../user-profile/dto/response/FarmerSummaryResponse';
import {getOrderStatusText, OrderStatus} from '../../../ordering/domain/order-status.enum';
import {ToastrService} from 'ngx-toastr';

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
    BaseChartDirective],
  templateUrl: './admin-stats.component.html',
})
export class AdminStatsComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private toastr = inject(ToastrService);

  stats = signal<DashboardStatsResponse | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  recentActivities = signal<RecentActivityResponse[]>([]);

  topFarmers = signal<FarmerSummaryResponse[]>([]);
  topBuyers = signal<UserResponse[]>([]);



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


  // Cấu hình cho biểu đồ tròn (Pie Chart)
  public pieChartData: ChartData<'pie'> = {
    labels: [], // VD: ['Chờ xử lý', 'Đang giao', 'Hoàn thành']
    datasets: [{
      data: [], // VD: [10, 5, 50]
      backgroundColor: [ // Thêm màu sắc cho đẹp
        '#facc15', // yellow-400
        '#3b82f6', // blue-500
        '#22c55e', // green-500
        '#ef4444', // red-500
        '#6b7280'  // gray-500
      ],
      hoverBackgroundColor: [
        '#fde047',
        '#60a5fa',
        '#4ade80',
        '#f87171',
        '#9ca3af'
      ],
      borderWidth: 1
    }]
  };
  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
    }
  };
  public pieChartType: ChartType = 'pie';

  public userGrowthChartData: ChartData<'line'> = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Người dùng mới',
        fill: true, // Tô màu nền cho đẹp
        tension: 0.4,
        borderColor: '#3b82f6', // blue-500
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        pointBackgroundColor: '#3b82f6',
      }
    ]
  };

  public userGrowthChartOptions: ChartConfiguration['options'] = { responsive: true,
    scales: {
      x: {
        type: 'category', // Đảm bảo trục x là category nếu labels là string
      },
      y: {
        beginAtZero: true, // Bắt đầu trục y từ 0
      },
    }, };
  public userGrowthChartType: ChartType = 'line';

  ngOnInit(): void {

    Chart.register(
      CategoryScale,
      LinearScale,
      LineController,
      LineElement,
      PointElement,
      Tooltip ,
      PieController,
      ArcElement,
      Legend
    );
    this.loadStats();
    this.loadRevenueChartData(); // Gọi hàm lấy dữ liệu biểu đồ

    // Gọi hàm tải dữ liệu cho biểu đồ số lượng đơn hàng nếu bạn muốn hiển thị nó
     this.loadOrderCountChartData();
    this.loadRecentActivities();
    this.loadTopFarmers();
    this.loadTopBuyers();
    this.loadUserGrowthChartData();
    this.loadPendingApprovalCounts();
  }

  loadStats(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.dashboardService.getAdminDashboardStats().subscribe({
      next: (response: ApiResponse<DashboardStatsResponse>) => {
        if (response.success && response.data) {
          this.stats.set(response.data);
          if (response.data.orderStatusDistribution) {
            this.updateOrderStatusChart(response.data.orderStatusDistribution);
          }
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

  loadUserGrowthChartData(): void {
    const endDate = LocalDate.now();
    const startDate = endDate.minusDays(14); // Lấy dữ liệu 2 tuần gần nhất

    this.dashboardService.getDailyUserRegistrations(startDate, endDate).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.userGrowthChartData.labels = response.data.map(item =>
            // Format lại ngày cho đẹp hơn, ví dụ: 10/06
            LocalDate.parse(item.date.toString()).format(DateTimeFormatter.ofPattern('dd/MM'))
          );
          this.userGrowthChartData.datasets[0].data = response.data.map(item => item.value as number);
        } else {
          this.toastr.error(response.message || 'Không thể tải dữ liệu tăng trưởng người dùng.');
        }
      },
      error: (err) => {
        console.error('Lỗi khi tải dữ liệu tăng trưởng người dùng:', err);
        this.toastr.error('Lỗi khi tải dữ liệu tăng trưởng người dùng.');
      }
    });
  }

  loadTopFarmers(): void {
    this.dashboardService.getTopPerformingFarmers(5).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.topFarmers.set(res.data);
        }
      },
      error: (err) => console.error('Lỗi khi tải top nông dân:', err)
    });
  }

  loadTopBuyers(): void {
    this.dashboardService.getTopSpendingBuyers(5).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.topBuyers.set(res.data);
        }
      },
      error: (err) => console.error('Lỗi khi tải top người mua:', err)
    });
  }

  updateOrderStatusChart(distribution: { [key: string]: number }): void {
    // Lọc bỏ các trạng thái có giá trị 0 để biểu đồ gọn hơn
    const filteredLabels = Object.keys(distribution).filter(key => distribution[key] > 0);

    this.pieChartData.labels = filteredLabels.map(key => getOrderStatusText(key as OrderStatus));
    this.pieChartData.datasets[0].data = filteredLabels.map(key => distribution[key]);
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

  isGrowthOrEqual(
    current: number | string | BigDecimal | null | undefined,
    previous: number | string | BigDecimal | null | undefined
  ): boolean {
    // Helper function để chuyển đổi an toàn sang string hoặc number
    const toPrimitive = (val: any): string | number => {
      if (val instanceof BigDecimal) {
        return val.getValue(); // Lấy giá trị string từ đối tượng BigDecimal
      }
      return val ?? 0; // Nếu là null/undefined thì trả về 0, còn lại giữ nguyên
    };

    const currentVal = new BigDecimal(toPrimitive(current));
    const previousVal = new BigDecimal(toPrimitive(previous));
    return currentVal.compareTo(previousVal) >= 0;
  }


  isDecline(
    current: number | string | BigDecimal | null | undefined,
    previous: number | string | BigDecimal | null | undefined
  ): boolean {
    const toPrimitive = (val: any): string | number => {
      if (val instanceof BigDecimal) {
        return val.getValue();
      }
      return val ?? 0;
    };

    const currentVal = new BigDecimal(toPrimitive(current));
    const previousVal = new BigDecimal(toPrimitive(previous));
    return currentVal.compareTo(previousVal) < 0;
  }


  calculateGrowthPercentage(
    current: number | string | BigDecimal | null | undefined,
    previous: number | string | BigDecimal | null | undefined
  ): number {
    const toPrimitive = (val: any): string | number => {
      if (val instanceof BigDecimal) {
        return val.getValue();
      }
      return val ?? 0;
    };

    // Chuyển đổi tất cả các giá trị đầu vào thành đối tượng BigDecimal để tính toán
    const currentVal = new BigDecimal(toPrimitive(current));
    const previousVal = new BigDecimal(toPrimitive(previous));

    // Nếu giá trị tháng trước là 0
    if (previousVal.compareTo(new BigDecimal(0)) === 0) {
      // Nếu tháng này có doanh thu > 0, coi như tăng 100%. Nếu không, là 0%.
      return currentVal.compareTo(new BigDecimal(0)) > 0 ? 100 : 0;
    }

    // Tính toán phần trăm: ((current - previous) / previous) * 100
    const difference = currentVal.subtract(previousVal);
    const percentage = difference.divide(previousVal, 4).multiply(new BigDecimal(100)); // Chia với 4 chữ số thập phân cho chính xác

    // Lấy giá trị tuyệt đối và làm tròn đến 1 chữ số thập phân
    const absolutePercentage = Math.abs(parseFloat(percentage.getValue()));
    return Math.round(absolutePercentage * 10) / 10;
  }

}
