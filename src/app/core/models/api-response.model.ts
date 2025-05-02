export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T; // Dữ liệu có thể có hoặc không (optional)
  status: number; // Mã trạng thái HTTP
  timestamp: string; // Kiểu string vì JSON trả về thường là string ISO date
  // errorCode?: string; // Mã lỗi tùy chỉnh (optional)
  // errors?: Record<string, string>; // Chi tiết lỗi validation (optional)
  // ****** THÊM TRƯỜNG NÀY ******
  // details là một object chứa thông tin lỗi bổ sung (ví dụ: errorCode, availableStock)
  // Dùng Record<string, any> để linh hoạt cho các loại lỗi khác nhau
  // Đặt là optional (?) vì response thành công sẽ không có details
  details?: Record<string, any>;
  // ****************************
}

// Có thể tạo thêm interface cho Paged Data nếu API trả về phân trang
export interface PageData<T> {
  content: T[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: {
      sorted: boolean;
      unsorted: boolean;
      empty: boolean;
    };
    offset: number;
    paged: boolean;
    unpaged: boolean;
  };
  last: boolean;
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  sort: {
    sorted: boolean;
    unsorted: boolean;
    empty: boolean;
  };
  first: boolean;
  numberOfElements: number;
  empty: boolean;
}

// Ví dụ ApiResponse cho dữ liệu phân trang
export interface PagedApiResponse<T> extends ApiResponse<PageData<T>> {}
