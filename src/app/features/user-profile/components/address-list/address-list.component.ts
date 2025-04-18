import { Component, OnInit, inject, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserProfileService } from '../../services/user-profile.service';
import { Address } from '../../domain/address.model';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { AddressFormComponent } from '../address-form/address-form.component'; // Import form component

@Component({
  selector: 'app-address-list',
  standalone: true,
  imports: [CommonModule, AddressFormComponent], // Import AddressForm
  templateUrl: './address-list.component.html',
})
export class AddressListComponent implements OnInit {
  private userProfileService = inject(UserProfileService);

  addresses: WritableSignal<Address[]> = signal([]);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  showAddressModal = signal(false); // Signal điều khiển modal
  selectedAddress = signal<Address | null>(null); // Địa chỉ đang được sửa (null nếu thêm mới)

  ngOnInit(): void {
    this.loadAddresses();
  }

  loadAddresses(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.userProfileService.getMyAddresses().subscribe({
      next: (response: ApiResponse<Address[]>) => {
        if (response.success && response.data) {
          this.addresses.set(response.data);
        } else {
          this.errorMessage.set(response.message || 'Failed to load addresses.');
        }
        this.isLoading.set(false);
      },
      error: (err: ApiResponse<null>) => {
        this.errorMessage.set(err.message || 'An error occurred.');
        this.isLoading.set(false);
      }
    });
  }

  openAddModal(): void {
    this.selectedAddress.set(null); // Đảm bảo không có địa chỉ nào được chọn (là thêm mới)
    this.showAddressModal.set(true);
    // Logic mở modal của DaisyUI (ví dụ dùng ID)
    const modal = document.getElementById('address_modal') as HTMLDialogElement | null;
    modal?.showModal();
  }

  openEditModal(address: Address): void {
    this.selectedAddress.set(address); // Gán địa chỉ cần sửa
    this.showAddressModal.set(true);
    const modal = document.getElementById('address_modal') as HTMLDialogElement | null;
    modal?.showModal();
  }

  closeModal(): void {
    this.showAddressModal.set(false);
    const modal = document.getElementById('address_modal') as HTMLDialogElement | null;
    modal?.close();
  }

  handleAddressSaved(savedAddress: Address): void {
    // Sau khi lưu thành công từ form (thêm hoặc sửa)
    this.loadAddresses(); // Tải lại danh sách
    this.closeModal();
    // Hiển thị thông báo thành công nếu cần
  }

  deleteAddress(id: number): void {
    if (confirm('Bạn có chắc chắn muốn xóa địa chỉ này?')) {
      // TODO: Thêm trạng thái loading khi xóa
      this.userProfileService.deleteAddress(id).subscribe({
        next: () => {
          this.loadAddresses(); // Tải lại danh sách
          // Hiển thị thông báo thành công
        },
        error: (err: ApiResponse<null>) => {
          this.errorMessage.set(err.message || 'Lỗi khi xóa địa chỉ.');
          // Hiển thị thông báo lỗi
        }
      });
    }
  }

  setDefaultAddress(id: number): void {
    // TODO: Thêm trạng thái loading
    this.userProfileService.setDefaultAddress(id).subscribe({
      next: () => {
        this.loadAddresses(); // Tải lại để cập nhật trạng thái isDefault
        // Hiển thị thông báo thành công
      },
      error: (err: ApiResponse<null>) => {
        this.errorMessage.set(err.message || 'Lỗi khi đặt làm mặc định.');
        // Hiển thị thông báo lỗi
      }
    });
  }
}
