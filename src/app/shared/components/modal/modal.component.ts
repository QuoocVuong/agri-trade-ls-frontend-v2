import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <dialog #modalElement class="modal" [class.modal-open]="isOpen">
      <div class="modal-box" [ngClass]="modalBoxClasses">
        <!-- Header -->
        <div *ngIf="title" class="flex justify-between items-center pb-3 border-b border-base-300 mb-4">
           <h3 class="font-bold text-lg">{{ title }}</h3>
           <button *ngIf="showCloseButton" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" (click)="close()">✕</button>
        </div>
        <!-- Content -->
        <ng-content></ng-content> <!-- Nội dung được truyền vào từ bên ngoài -->

        <!-- Footer (Optional) -->
         <div *ngIf="showActions" class="modal-action mt-6">
             <ng-content select="[modal-actions]"></ng-content> <!-- Chỗ đặt các nút action -->
             <button *ngIf="!hideDefaultCancel" class="btn btn-sm btn-ghost" (click)="close()">{{ cancelText }}</button>
         </div>
      </div>
      <!-- Backdrop -->
      <form method="dialog" class="modal-backdrop" (click)="closeOnBackdropClick ? close() : null">
        <!-- <button>close</button> --> <!-- Không cần button này nếu xử lý đóng ở backdrop click -->
      </form>
    </dialog>
  `,
})
export class ModalComponent implements OnChanges {
  @Input() title?: string;
  @Input() isOpen: boolean = false; // Điều khiển trạng thái mở/đóng từ bên ngoài
  @Input() showCloseButton: boolean = true; // Hiển thị nút X ở góc
  @Input() closeOnBackdropClick: boolean = true; // Đóng khi bấm ra ngoài
  @Input() modalBoxClasses: string = 'w-11/12 max-w-lg'; // Tùy chỉnh kích thước modal
  @Input() showActions: boolean = false; // Có hiển thị khu vực action mặc định không
  @Input() hideDefaultCancel: boolean = false; // Ẩn nút Cancel mặc định trong khu vực action
  @Input() cancelText: string = 'Hủy';

  @Output() closed = new EventEmitter<void>(); // Event khi modal đóng

  @ViewChild('modalElement') modalElement!: ElementRef<HTMLDialogElement>;

  ngOnChanges(changes: SimpleChanges): void {
    // Tự động mở/đóng modal khi Input isOpen thay đổi
    if (changes['isOpen']) {
      this.toggleModal(this.isOpen);
    }
  }

  toggleModal(open: boolean): void {
    if (this.modalElement?.nativeElement) {
      if (open) {
        this.modalElement.nativeElement.showModal();
      } else {
        this.modalElement.nativeElement.close();
      }
    }
  }

  // Hàm để đóng modal từ bên trong component (ví dụ nút cancel)
  close(): void {
    this.isOpen = false; // Cập nhật trạng thái
    this.toggleModal(false);
    this.closed.emit(); // Bắn sự kiện đã đóng
  }
}
