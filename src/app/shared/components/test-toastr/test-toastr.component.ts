// src/app/shared/components/test-toastr/test-toastr.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common'; // Import CommonModule nếu cần dùng *ngIf, etc.

@Component({
  selector: 'app-test-toastr',
  standalone: true,
  imports: [CommonModule], // Thêm CommonModule nếu cần
  template: `
    <div class="my-4 p-4 border border-dashed border-gray-400 rounded-md">
      <h4 class="font-semibold mb-2">Khu vực Test Toastr:</h4>
      <button class="btn btn-accent btn-sm" (click)="showTestToast()">Hiển thị Toast Test</button>
      <p *ngIf="testMessage" class="text-xs mt-2 text-gray-500">{{ testMessage }}</p>
    </div>
  `,
})
export class TestToastrComponent implements OnInit {
  private toastr = inject(ToastrService);
  testMessage: string = '';

  ngOnInit(): void {
    this.testMessage = 'TestToastrComponent đã khởi tạo. ToastrService ' + (this.toastr ? 'đã được inject.' : 'CHƯA được inject!');
    console.log(this.testMessage);
  }

  showTestToast() {
    console.log('Nút "Hiển thị Toast Test" đã được nhấn. Đang gọi toastr.info()...');
    this.toastr.info('Đây là thông báo test từ TestToastrComponent!', 'Toastr Test', {
      timeOut: 3000,
      progressBar: true,
      closeButton: true
    });
    this.testMessage = 'Đã gọi this.toastr.info() lúc ' + new Date().toLocaleTimeString();
  }
}
