import { Component, OnInit, inject, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserProfileService } from '../../services/user-profile.service';
import { Address } from '../../domain/address.model';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { AddressFormComponent } from '../address-form/address-form.component';
import {AlertComponent} from '../../../../shared/components/alert/alert.component';
import {LoadingSpinnerComponent} from '../../../../shared/components/loading-spinner/loading-spinner.component';
import {LocationService} from '../../../../core/services/location.service';
import {Observable, of, shareReplay} from 'rxjs';
import {ToastrService} from 'ngx-toastr';
import {ConfirmationService} from '../../../../shared/services/confirmation.service';

@Component({
  selector: 'app-address-list',
  standalone: true,
  imports: [CommonModule, AddressFormComponent, AlertComponent,LoadingSpinnerComponent],
  templateUrl: './address-list.component.html',
})
export class AddressListComponent implements OnInit {
  private userProfileService = inject(UserProfileService);
  private locationService = inject(LocationService);
  private confirmationService = inject(ConfirmationService);
  private toastr = inject(ToastrService);


  addresses: WritableSignal<Address[]> = signal([]);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  showAddressModal = signal(false); // Signal điều khiển modal
  selectedAddress = signal<Address | null>(null); // Địa chỉ đang được sửa (null nếu thêm mới)

  private locationNameCache = new Map<string, Observable<string | null>>();

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
    this.confirmationService.open({
      title: 'Xác Nhận Xóa Địa Chỉ',
      message: 'Bạn có chắc chắn muốn xóa địa chỉ này không? Hành động này không thể hoàn tác.',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      confirmButtonClass: 'btn-error',
      iconClass: 'fas fa-trash-alt',
      iconColorClass: 'text-error'
    }).subscribe(confirmed => {
      if (confirmed) {
        this.isLoading.set(true); // Bật loading chung của trang
        this.errorMessage.set(null);

        this.userProfileService.deleteAddress(id).subscribe({
          next: () => {
            this.toastr.success('Đã xóa địa chỉ thành công.');
            this.loadAddresses(); // Tải lại danh sách để cập nhật UI
          },
          error: (err: ApiResponse<null>) => {
            this.errorMessage.set(err.message || 'Lỗi khi xóa địa chỉ.');
            this.toastr.error(err.message || 'Lỗi khi xóa địa chỉ.');
            this.isLoading.set(false); // Tắt loading nếu có lỗi
          }
          // Không cần finalize ở đây vì loadAddresses sẽ set lại isLoading
        });
      }
    });

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


  getLocationName(type: 'province' | 'district' | 'ward', code: string | null | undefined): Observable<string | null> {
    if (!code || code === 'undefined') { // Xử lý cả chuỗi "undefined"
      return of(null); // Trả về null nếu code không hợp lệ
    }

    const cacheKey = `${type}_${code}`;
    if (this.locationNameCache.has(cacheKey)) {
      return this.locationNameCache.get(cacheKey)!;
    }

    let name$: Observable<string | null>;
    switch (type) {
      case 'province':
        name$ = this.locationService.findProvinceName(code);
        break;
      case 'district':
        name$ = this.locationService.findDistrictName(code);
        break;
      case 'ward':
        name$ = this.locationService.findWardName(code);
        break;
      default:
        name$ = of(null);
      }
      // Cache kết quả observable để tránh gọi lại API/tìm kiếm nhiều lần
      const cachedName$ = name$.pipe(shareReplay(1));
      this.locationNameCache.set(cacheKey, cachedName$);
      return cachedName$;
    }


  trackAddressById(index: number, item: Address): number {
    return item.id;
  }

  }
