import {Component, Output, EventEmitter, inject, signal, OnDestroy, Input} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpEventType, HttpResponse } from '@angular/common/http'; // Import HttpClient và các kiểu liên quan
import { finalize, catchError, tap } from 'rxjs/operators';
import { throwError, Subject, takeUntil } from 'rxjs';
import { environment } from '../../../../environments/environment'; // Import environment
import { ApiResponse } from '../../../core/models/api-response.model';
import { FileUploadResponse } from '../../../common/dto/response/FileUploadResponse'; // Import DTO response
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-file-uploader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-uploader.component.html',
})
export class FileUploadComponent implements OnDestroy {
  private http = inject(HttpClient);
  private toastr = inject(ToastrService);
  private uploadUrl = `${environment.apiUrl}/files/upload`; // API endpoint upload

  // ****** SỬ DỤNG LẠI CÁC INPUT ĐÃ SỬA ******
  @Input({ required: true }) uploadUrlPath!: string; // Chỉ nhận path, ví dụ: '/files/upload'
  @Input() allowedTypes: string[] = ['image/*'];
  @Input() uploadParams: { [key: string]: string } = {}; // Nhận các tham số bổ sung
  // ******************************************

  @Output() uploadSuccess  = new EventEmitter<FileUploadResponse>(); // Event trả về thông tin file đã upload
  @Output() uploadError = new EventEmitter<string>(); // Event báo lỗi

  isUploading = signal(false);
  uploadProgress = signal<number | null>(null); // Tiến trình upload (0-100)
  fileName = signal<string | null>(null); // Tên file đang chọn

  private destroy$ = new Subject<void>();

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFileSelected(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    let fileList: FileList | null = element.files;

    if (fileList && fileList.length > 0) {
      const file = fileList[0];

      if (!this.isFileTypeAllowed(file.type)) {
        const errorMsg = `Loại file không hợp lệ. Chỉ chấp nhận: ${this.allowedTypes.join(', ')}`;
        this.errorMessage.set(errorMsg);
        this.uploadError.emit(errorMsg);
        this.toastr.error(errorMsg);
        element.value = '';
        return;
      }

      this.fileName.set(file.name);
      this.uploadFile(file); // Gọi hàm upload ngay khi chọn file
    } else {
      this.fileName.set(null);
    }
    // Reset input để có thể chọn lại cùng file
    element.value = '';
  }

  private isFileTypeAllowed(fileType: string): boolean {
    if (!this.allowedTypes || this.allowedTypes.length === 0) return true;
    return this.allowedTypes.some(allowedType => {
      if (allowedType.endsWith('/*')) {
        return fileType.startsWith(allowedType.slice(0, -1));
      } else {
        return allowedType === fileType;
      }
    });
  }

  uploadFile(file: File): void {
    this.isUploading.set(true);
    this.uploadProgress.set(0);
    this.errorMessage.set(null); // Reset lỗi cũ

    const formData = new FormData();
    formData.append('file', file, file.name);

    // ****** SỬ DỤNG uploadParams TỪ INPUT ******
    for (const key in this.uploadParams) {
      if (this.uploadParams.hasOwnProperty(key)) {
        formData.append(key, this.uploadParams[key]); // Thêm 'type' và các params khác vào đây
      }
    }
    // ***************************************

    // ****** TẠO URL ĐẦY ĐỦ TỪ INPUT ******
    const fullUploadUrl = `${environment.apiUrl}${this.uploadUrlPath}`;
    // ************************************

    this.http.post<ApiResponse<FileUploadResponse>>(fullUploadUrl, formData, {
      reportProgress: true, // Bật theo dõi tiến trình
      observe: 'events' // Lắng nghe tất cả các sự kiện HTTP
    })
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          const message = err?.error?.message || err?.message || 'Lỗi không xác định khi upload.';
          this.errorMessage.set(message);
          this.uploadError.emit(message); // Bắn sự kiện lỗi
          console.error("Upload error:", err);
          return throwError(() => new Error(message)); // Ném lại lỗi
        }),
        finalize(() => {
          this.isUploading.set(false);
          this.uploadProgress.set(null); // Reset progress
          this.fileName.set(null); // Reset tên file
        })
      )
      .subscribe(event => {
        if (event.type === HttpEventType.UploadProgress) {
          // Tính toán và cập nhật tiến trình upload
          const progress = Math.round(100 * event.loaded / (event.total ?? event.loaded)); // Handle total = 0 or undefined
          this.uploadProgress.set(progress);
        } else if (event instanceof HttpResponse) {
          // Upload thành công (event.body là ApiResponse<FileUploadResponse>)
          const responseBody = event.body;
          if (responseBody?.success && responseBody.data) {
            this.toastr.success(`Đã tải lên: ${responseBody.data.fileName}`);
            this.uploadSuccess.emit(responseBody.data); // Bắn sự kiện thành công với thông tin file
          } else {
            const message = responseBody?.message || 'Lỗi không rõ khi upload file.';
            this.errorMessage.set(message);
            this.uploadError.emit(message);
            this.toastr.error(message);
          }
        }
      });
  }

  // Signal cho thông báo lỗi nội bộ của component này
  errorMessage = signal<string | null>(null);
}
