import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common'; // Import DecimalPipe
import { DashboardService } from '../../../user-profile/services/DashboardService'; // Import DashboardService (đặt ở user-profile hoặc admin-dashboard)
import { DashboardStatsResponse } from '../../../user-profile/dto/response/DashboardStatsResponse'; // Import DTO
import { ApiResponse } from '../../../../core/models/api-response.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { RouterLink } from '@angular/router';
import {FormatBigDecimalPipe} from '../../../../shared/pipes/format-big-decimal.pipe'; // Import RouterLink

@Component({
  selector: 'app-admin-stats',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent, AlertComponent, DecimalPipe, RouterLink, FormatBigDecimalPipe], // Thêm DecimalPipe, RouterLink
  templateUrl: './admin-stats.component.html',
})
export class AdminStatsComponent implements OnInit {
  private dashboardService = inject(DashboardService);

  stats = signal<DashboardStatsResponse | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadStats();
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
}
