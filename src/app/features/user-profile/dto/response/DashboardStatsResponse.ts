// src/app/features/user-profile/dto/response/DashboardStatsResponse.ts
import  BigDecimal  from 'js-big-decimal'; // Hoặc dùng number/string

// DTO này chứa các số liệu thống kê cho cả Farmer và Admin Dashboard
// Sử dụng optional (?) cho các trường không áp dụng cho cả hai vai trò
// Hoặc có thể tạo DTO riêng cho Farmer và Admin nếu muốn rõ ràng hơn
export interface DashboardStatsResponse {
  // --- Số liệu chung (Có thể dùng cho cả hai) ---
  totalOrdersToday?: number | null;
  totalOrdersThisMonth?: number | null;
  totalRevenueToday?: number | string | BigDecimal | null;
  totalRevenueThisMonth?: number | string | BigDecimal | null;

  // --- Số liệu riêng cho Farmer ---
  pendingOrders?: number | null;           // Đơn hàng mới/đang xử lý của farmer
  lowStockProducts?: number | null;        // Sản phẩm sắp hết hàng của farmer
  pendingReviewsOnMyProducts?: number | null; // Review mới cho sp của farmer

  // --- Số liệu riêng cho Admin ---
  totalUsers?: number | null;              // Tổng user (cần làm rõ active hay total)
  totalFarmers?: number | null;            // Tổng số farmer
  totalConsumers?: number | null;          // Tổng số consumer
  totalBusinessBuyers?: number | null;     // Tổng số business buyer
  pendingFarmerApprovals?: number | null;  // Farmer chờ duyệt
  pendingProductApprovals?: number | null; // Sản phẩm chờ duyệt
  pendingReviews?: number | null;          // Tổng review chờ duyệt
}

// Có thể dùng @Builder ở backend để dễ tạo response hơn,
// nhưng ở frontend chỉ cần interface là đủ.
