import { Component, OnInit, inject, signal, computed, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms'; // Import Forms
import { Page } from '../../../../core/models/page.model';
import { UserResponse } from '../../../user-profile/dto/response/UserResponse';
import { UserProfileResponse } from '../../../user-profile/dto/response/UserProfileResponse'; // Import UserProfileResponse
import { AdminUserService } from '../../services/admin-user.service'; // Import AdminUserService
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component'; // Import Modal
import { RoleType, getRoleTypeText } from '../../../../common/model/role-type.enum'; // Import RoleType
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-manage-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LoadingSpinnerComponent, AlertComponent, PaginatorComponent, ModalComponent, DatePipe],
  templateUrl: './manage-users.component.html',
})
export class ManageUsersComponent implements OnInit {
  private adminUserService = inject(AdminUserService);
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();

  usersPage = signal<Page<UserResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  // Filter form
  filterForm = this.fb.group({
    keyword: [''],
    role: [''], // Giá trị rỗng nghĩa là không lọc theo role
    isActive: ['']
  });

  // Phân trang & Sắp xếp
  currentPage = signal(0);
  pageSize = signal(15);
  sort = signal('createdAt,desc'); // Mặc định

  // Lấy danh sách RoleType để hiển thị trong dropdown filter
  roleTypes = Object.values(RoleType);
  getRoleText = getRoleTypeText; // Đưa hàm helper vào component

  // State cho modal xem chi tiết/sửa role
  showDetailModal = signal(false);
  showRoleModal = signal(false);
  selectedUser = signal<UserProfileResponse | null>(null); // Lưu profile đầy đủ khi xem chi tiết
  selectedUserIdForRoles = signal<number | null>(null); // ID user đang sửa role
  availableRoles = signal<RoleType[]>(Object.values(RoleType)); // Tất cả các role
  currentUserRoles = signal<Set<RoleType>>(new Set()); // Roles hiện tại của user đang sửa

  ngOnInit(): void {
    this.loadUsers();

    // Lắng nghe thay đổi filter để load lại (với debounce)
    this.filterForm.valueChanges.pipe(
      debounceTime(500), // Chờ 500ms sau khi ngừng gõ
      distinctUntilChanged(), // Chỉ gọi nếu giá trị thay đổi
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage.set(0); // Reset về trang đầu khi filter
      this.loadUsers();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const formValue = this.filterForm.value;

    let isActiveValue: boolean | undefined = undefined;
    if (formValue.isActive === 'true') {
      isActiveValue = true;
    } else if (formValue.isActive === 'false') {
      isActiveValue = false;
    }
    // Nếu formValue.isActive là chuỗi rỗng '', isActiveValue sẽ là undefined (không lọc)

    const params = {
      page: this.currentPage(),
      size: this.pageSize(),
      sort: this.sort(),
      keyword: formValue.keyword?.trim() || undefined,
      role: formValue.role || undefined, // RoleType hoặc string
      isActive: isActiveValue  // Truyền giá trị boolean hoặc undefined
    };

    this.adminUserService.getAllUsers(
      params.page,
      params.size,
      params.sort,
      params.role as RoleType | string, // Ép kiểu nếu cần
      params.keyword,
      params.isActive // Truyền isActive
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.usersPage.set(res.data);
          } else {
            this.usersPage.set(null);
            this.errorMessage.set(res.message || 'Không tải được danh sách người dùng.');
          }
          this.isLoading.set(false);
        },
        error: (err) => this.handleError(err, 'Lỗi khi tải danh sách người dùng.')
      });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    // Effect sẽ tự động load lại
  }

  // Mở modal xem chi tiết
  viewUserDetails(userId: number): void {
    this.isLoading.set(true); // Hiện loading tạm thời
    this.adminUserService.getUserProfileById(userId).subscribe({
      next: (res) => {
        if(res.success && res.data) {
          this.selectedUser.set(res.data);
          this.showDetailModal.set(true);
        } else {
          this.toastr.error(res.message || 'Không thể lấy chi tiết người dùng.');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.handleError(err, 'Lỗi khi lấy chi tiết người dùng.');
        this.isLoading.set(false);
      }
    });
  }

  // Mở modal sửa Roles
  openEditRolesModal(user: UserResponse): void {
    this.selectedUserIdForRoles.set(user.id);
    this.currentUserRoles.set(new Set(user.roles as RoleType[])); // Chuyển mảng string roles thành Set<RoleType>
    this.showRoleModal.set(true);
  }

  // Đóng modals
  closeDetailModal(): void {
    this.showDetailModal.set(false);
    this.selectedUser.set(null);
  }
  closeRoleModal(): void {
    this.showRoleModal.set(false);
    this.selectedUserIdForRoles.set(null);
    this.currentUserRoles.set(new Set());
  }

  // Xử lý khi checkbox role thay đổi
  onRoleChange(event: Event, role: RoleType): void {
    const checkbox = event.target as HTMLInputElement;
    this.currentUserRoles.update(currentRoles => {
      if (checkbox.checked) {
        currentRoles.add(role);
      } else {
        currentRoles.delete(role);
      }
      return new Set(currentRoles); // Trả về Set mới để trigger change detection nếu cần
    });
  }

  // Lưu thay đổi Roles
  saveRoles(): void {
    const userId = this.selectedUserIdForRoles();
    if (!userId) return;

    this.isLoading.set(true); // Dùng loading chung hoặc tạo signal riêng
    const rolesToSave = Array.from(this.currentUserRoles()); // Chuyển Set thành Array

    this.adminUserService.updateUserRoles(userId, rolesToSave).subscribe({
      next: (res) => {
        if (res.success) {
          this.toastr.success('Cập nhật vai trò thành công!');
          this.closeRoleModal();
          this.loadUsers(); // Load lại danh sách để thấy thay đổi
        } else {
          this.handleError(res, 'Lỗi cập nhật vai trò.');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.handleError(err, 'Lỗi cập nhật vai trò.');
        this.isLoading.set(false);
      }
    });
  }

  // Cập nhật trạng thái Active/Inactive
  toggleUserStatus(user: UserResponse): void {
    const newStatus = !user.active; // Đảo ngược trạng thái hiện tại
    const actionText = newStatus ? 'Kích hoạt' : 'Vô hiệu hóa';
    if (confirm(`Bạn có chắc muốn ${actionText} người dùng "${user.fullName}"?`)) {
      this.isLoading.set(true); // Dùng loading chung
      this.adminUserService.updateUserStatus(user.id, newStatus).subscribe({
        next: (res) => {
          if(res.success) {
            this.toastr.success(`Đã ${actionText} người dùng.`);
            this.loadUsers(); // Load lại danh sách
          } else {
            this.handleError(res, `Lỗi khi ${actionText} người dùng.`);
          }
          this.isLoading.set(false);
        },
        error: (err) => {
          this.handleError(err, `Lỗi khi ${actionText} người dùng.`);
          this.isLoading.set(false);
        }
      });
    }
  }


  // Helper xử lý lỗi
  private handleError(err: any, defaultMessage: string): void {
    const message = err?.message || defaultMessage;
    this.errorMessage.set(message); // Hiển thị lỗi trên alert chung của trang
    this.toastr.error(message);
    this.isLoading.set(false); // Đảm bảo tắt loading khi có lỗi
    console.error(err);
  }

  trackUserById(index: number, item: UserResponse): number {
    return item.id;
  }
}
