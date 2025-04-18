// src/app/core/models/page.model.ts

// Interface mô tả cấu trúc dữ liệu phân trang trả về từ Spring Data Pageable
// Thường giống với PageData trong ApiResponse, nhưng tách ra để rõ ràng hơn
export interface Page<T> {
  content: T[];          // Danh sách các phần tử của trang hiện tại
  pageable: {
    pageNumber: number;    // Số trang hiện tại (bắt đầu từ 0)
    pageSize: number;      // Số phần tử mỗi trang
    sort: {
      sorted: boolean;   // Có sắp xếp không
      unsorted: boolean; // Không sắp xếp?
      empty: boolean;    // Sắp xếp rỗng?
    };
    offset: number;        // Vị trí bắt đầu của trang
    paged: boolean;        // Có phân trang không
    unpaged: boolean;      // Không phân trang?
  };
  last: boolean;           // Là trang cuối cùng?
  totalPages: number;      // Tổng số trang
  totalElements: number;   // Tổng số phần tử
  size: number;            // Kích thước trang (giống pageSize)
  number: number;          // Số trang hiện tại (giống pageNumber)
  sort: {
    sorted: boolean;
    unsorted: boolean;
    empty: boolean;
  };
  first: boolean;          // Là trang đầu tiên?
  numberOfElements: number;// Số phần tử thực tế trên trang này
  empty: boolean;          // Trang có rỗng không?
}

// Có thể tạo thêm interface cho Pageable nếu cần gửi lên server
export interface PageableRequest {
  page?: number;
  size?: number;
  sort?: string; // ví dụ: "createdAt,desc"
}
export interface PageableInfo {
  pageNumber: number;
  pageSize: number;
  sort: SortInfo;
  offset: number;
  paged: boolean;
  unpaged: boolean;
}

export interface SortInfo {
  sorted: boolean;
  unsorted: boolean;
  empty: boolean;
}

// Interface cho yêu cầu phân trang gửi lên server (tùy chọn)
export interface PageableRequest {
  page?: number;
  size?: number;
  sort?: string; // ví dụ: "createdAt,desc" hoặc ["createdAt,desc", "name,asc"]
}
