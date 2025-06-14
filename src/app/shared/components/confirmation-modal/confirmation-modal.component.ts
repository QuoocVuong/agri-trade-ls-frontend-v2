import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../modal/modal.component';
import {FormsModule} from '@angular/forms'; // Import modal gốc
export interface ConfirmationInput {
  type: 'text' | 'textarea';
  label: string;
  placeholder?: string;
  initialValue?: string;
  key: string; // Key để định danh giá trị trả về
}
@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent, FormsModule],
  template: `
    <app-modal [isOpen]="isOpen" (closed)="onCancel()" [showActions]="false" modalBoxClasses="w-11/12 max-w-md">
      <div class="text-center p-4">
        <div *ngIf="iconClass" class="text-4xl mb-4" [ngClass]="iconColorClass">
          <i [class]="iconClass"></i>
        </div>
        <h3 class="font-bold text-lg mb-2">{{ title }}</h3>
        <p class="py-2 text-sm text-base-content/80">{{ message }}</p>


        <div *ngIf="inputs && inputs.length > 0" class="space-y-4 mt-4">
          <div *ngFor="let input of inputs" class="form-control w-full">
            <label class="label pb-1"><span class="label-text text-sm">{{ input.label }}</span></label>
            <input *ngIf="input.type === 'text'"
                   type="text"
                   [(ngModel)]="inputValues[input.key]"
                   [placeholder]="input.placeholder || ''"
                   class="input input-bordered input-sm w-full">
            <textarea *ngIf="input.type === 'textarea'"
                      [(ngModel)]="inputValues[input.key]"
                      [placeholder]="input.placeholder || ''"
                      class="textarea textarea-bordered h-20 w-full"></textarea>
          </div>
        </div>

      </div>
      <div class="flex justify-center gap-3 mt-6">
        <button class="btn btn-sm btn-ghost" (click)="onCancel()">{{ cancelText }}</button>
        <button class="btn btn-sm" [ngClass]="confirmButtonClass" (click)="onConfirm()">{{ confirmText }}</button>
      </div>
    </app-modal>
  `
})
export class ConfirmationModalComponent {
  @Input() isOpen = false;
  @Input() title = 'Xác nhận';
  @Input() message = 'Bạn có chắc chắn muốn thực hiện hành động này?';
  @Input() confirmText = 'Đồng ý';
  @Input() cancelText = 'Hủy bỏ';
  @Input() confirmButtonClass = 'btn-primary';
  @Input() iconClass: string | null = 'fas fa-question-circle'; // Ví dụ: 'fas fa-exclamation-triangle'
  @Input() iconColorClass: string = 'text-info'; // Ví dụ: 'text-warning'

  @Output() confirmed = new EventEmitter<{ [key: string]: string }>();
  @Output() cancelled = new EventEmitter<void>();

  @Input() inputs?: ConfirmationInput[];
  inputValues: { [key: string]: string } = {};

  ngOnInit() {
    // Khởi tạo giá trị ban đầu cho các input nếu có
    if (this.inputs) {
      this.inputs.forEach(input => {
        this.inputValues[input.key] = input.initialValue || '';
      });
    }
  }

  onConfirm(): void {
    this.confirmed.emit(this.inputValues);
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
