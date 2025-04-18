// src/app/features/user-profile/dto/response/TimeSeriesDataPoint.ts
import  BigDecimal  from 'js-big-decimal'; // Import nếu dùng
import { LocalDate } from '@js-joda/core'; // Import nếu dùng

/**
 * Đại diện cho một điểm dữ liệu trên biểu đồ theo thời gian.
 * T là kiểu dữ liệu của giá trị (ví dụ: number, string, BigDecimal).
 */
export interface TimeSeriesDataPoint<T> {
  /** Ngày hoặc khoảng thời gian (ví dụ: '2024-04-17') */
  date: string | LocalDate; // Sử dụng string là phổ biến nhất khi truyền qua API

  /** Giá trị tại điểm thời gian đó */
  value: T;
}
