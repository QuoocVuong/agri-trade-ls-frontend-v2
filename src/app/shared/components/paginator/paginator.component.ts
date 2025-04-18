import { Component, EventEmitter, Input, Output, computed, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-paginator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './paginator.component.html',
})
export class PaginatorComponent implements OnChanges {
  @Input({ required: true }) currentPage: number = 0; // Trang hiện tại (bắt đầu từ 0)
  @Input({ required: true }) totalPages: number = 1;
  @Input() pageRangeDisplayed: number = 5; // Số lượng trang hiển thị ở giữa
  @Output() pageChange = new EventEmitter<number>();

  // Signal nội bộ để tính toán các trang hiển thị
  private internalCurrentPage = signal(0);
  private internalTotalPages = signal(1);

  // Tính toán danh sách các trang cần hiển thị
  pages = computed(() => {
    const total = this.internalTotalPages();
    const current = this.internalCurrentPage();
    const range = this.pageRangeDisplayed;
    const sideWidth = Math.floor(range / 2);
    const pagesToShow: (number | string)[] = [];

    if (total <= range) {
      // Hiển thị tất cả các trang nếu tổng số trang nhỏ hơn hoặc bằng range
      for (let i = 0; i < total; i++) {
        pagesToShow.push(i);
      }
    } else {
      // Hiển thị trang đầu tiên
      pagesToShow.push(0);

      // Tính toán trang bắt đầu và kết thúc của khoảng giữa
      let startPage = Math.max(1, current - sideWidth);
      let endPage = Math.min(total - 2, current + sideWidth);

      // Điều chỉnh nếu khoảng bị lệch về đầu hoặc cuối
      if (current < sideWidth + 1) {
        endPage = Math.min(total - 2, range - 2);
      }
      if (current > total - sideWidth - 2) {
        startPage = Math.max(1, total - range + 1);
      }


      // Thêm dấu "..." nếu cần ở đầu
      if (startPage > 1) {
        pagesToShow.push('...');
      }

      // Thêm các trang trong khoảng giữa
      for (let i = startPage; i <= endPage; i++) {
        pagesToShow.push(i);
      }

      // Thêm dấu "..." nếu cần ở cuối
      if (endPage < total - 2) {
        pagesToShow.push('...');
      }

      // Hiển thị trang cuối cùng
      pagesToShow.push(total - 1);
    }
    return pagesToShow;
  });

  // Cập nhật signal nội bộ khi Input thay đổi
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentPage']) {
      this.internalCurrentPage.set(this.currentPage);
    }
    if (changes['totalPages']) {
      this.internalTotalPages.set(this.totalPages);
    }
  }

  goToPage(page: number | string): void {
    if (typeof page === 'number' && page >= 0 && page < this.totalPages && page !== this.currentPage) {
      this.pageChange.emit(page);
    }
  }

  goToPrevious(): void {
    if (this.currentPage > 0) {
      this.pageChange.emit(this.currentPage - 1);
    }
  }

  goToNext(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.pageChange.emit(this.currentPage + 1);
    }
  }

  isNumber(value: number | string): value is number {
    return typeof value === 'number';
  }
}
