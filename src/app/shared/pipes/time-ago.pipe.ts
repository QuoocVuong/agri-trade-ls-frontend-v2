import { Pipe, PipeTransform, ChangeDetectorRef, NgZone, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Pipe({
  name: 'timeAgo',
  standalone: true,
  pure: false // *** Đặt là false để pipe tự cập nhật ***
})
export class TimeAgoPipe implements PipeTransform, OnDestroy {
  private timer: number | null = null;
  private destroy$ = new Subject<void>();
  private lastValue: string | Date | number | null | undefined = null;
  private lastText: string = '';
  private lastDate: Date | null = null;

  // Inject ChangeDetectorRef và NgZone để cập nhật UI khi timer chạy
  constructor(private changeDetectorRef: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnDestroy(): void {
    this.removeTimer(); // Hủy timer khi pipe bị hủy
    this.destroy$.next();
    this.destroy$.complete();
  }

  transform(value: string | Date | number | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      this.removeTimer();
      return '';
    }

    // Chỉ tính toán lại nếu giá trị đầu vào thay đổi
    if (value !== this.lastValue) {
      this.lastValue = value;
      this.removeTimer(); // Xóa timer cũ nếu giá trị thay đổi
      try {
        this.lastDate = new Date(value);
        if (isNaN(this.lastDate.getTime())) {
          throw new Error('Invalid date');
        }
        this.lastText = this.calculateTimeAgo(this.lastDate); // Tính toán lần đầu
        this.setupTimer(); // Bắt đầu timer để cập nhật
      } catch (e) {
        console.error("TimeAgoPipe: Invalid date provided", value, e);
        this.lastText = 'Ngày không hợp lệ';
      }
    }

    return this.lastText;
  }

  private calculateTimeAgo(date: Date): string {
    const now = new Date();
    const seconds = Math.round(Math.abs(now.getTime() - date.getTime()) / 1000); // Dùng Math.abs để xử lý cả tương lai gần
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    const months = Math.round(days / 30.416); // ~30.4 ngày/tháng
    const years = Math.round(days / 365);

    if (seconds <= 45) {
      return 'vài giây trước';
    } else if (seconds <= 90) {
      return '1 phút trước';
    } else if (minutes <= 45) {
      return minutes + ' phút trước';
    } else if (minutes <= 90) {
      return '1 giờ trước';
    } else if (hours <= 22) {
      return hours + ' giờ trước';
    } else if (hours <= 36) {
      return '1 ngày trước';
    } else if (days <= 25) {
      return days + ' ngày trước';
    } else if (days <= 45) {
      return '1 tháng trước';
    } else if (days <= 345) {
      return months + ' tháng trước';
    } else if (days <= 545) {
      return '1 năm trước';
    } else { // (days > 545)
      return years + ' năm trước';
    }
  }

  private setupTimer() {
    this.removeTimer(); // Đảm bảo không có timer cũ nào chạy

    // Chạy timer bên ngoài zone của Angular để không trigger change detection không cần thiết
    this.ngZone.runOutsideAngular(() => {
      this.timer = window.setInterval(() => {
        const newText = this.calculateTimeAgo(this.lastDate!);
        // Chỉ cập nhật và trigger change detection nếu text thực sự thay đổi
        if (newText !== this.lastText) {
          this.lastText = newText;
          // Quay lại zone của Angular để cập nhật UI
          this.ngZone.run(() => {
            this.changeDetectorRef.markForCheck();
          });
        }
      }, 60000); // Cập nhật mỗi phút
    });
  }

  private removeTimer() {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }
}
