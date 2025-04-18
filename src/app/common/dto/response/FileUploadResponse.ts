// src/app/common/dto/response/FileUploadResponse.ts

/**
 * Thông tin trả về sau khi upload file thành công.
 */
export interface FileUploadResponse {
  /** Tên file duy nhất đã được lưu trên server */
  fileName: string;

  /** URL đầy đủ để truy cập file (có thể dùng trực tiếp cho thẻ img, a) */
  fileDownloadUri: string;

  /** Loại content type của file (ví dụ: 'image/jpeg', 'application/pdf') */
  fileType: string;

  /** Kích thước file (bytes) */
  size: number;
}
