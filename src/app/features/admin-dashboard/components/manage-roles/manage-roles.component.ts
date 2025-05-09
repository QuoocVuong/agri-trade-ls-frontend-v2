import { Component, OnInit, inject, signal, computed, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, FormControl, ReactiveFormsModule } from '@angular/forms'; // Import Forms
import { AdminInteractionService } from '../../services/admin-interaction.service'; // Import Service
import { RoleResponse } from '../../../user-profile/dto/response/RoleResponse';
import { PermissionResponse } from '../../../user-profile/dto/response/PermissionResponse';
import { RoleUpdateRequest } from '../../../user-profile/dto/request/RoleUpdateRequest';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ToastrService } from 'ngx-toastr';
import {forkJoin, Subject} from 'rxjs';
import { takeUntil, finalize, } from 'rxjs/operators'; // Import forkJoin
import { getRoleTypeText, RoleType } from '../../../../common/model/role-type.enum';
import {PermissionTranslatePipe} from '../../../../shared/pipes/permission-translate.pipe'; // Import RoleType helpers

@Component({
  selector: 'app-manage-roles',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LoadingSpinnerComponent, AlertComponent, ModalComponent, PermissionTranslatePipe ],
  templateUrl: './manage-roles.component.html',
})
export class ManageRolesComponent implements OnInit {
  private adminInteractionService = inject(AdminInteractionService);
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();

  roles = signal<RoleResponse[]>([]);
  allPermissions = signal<PermissionResponse[]>([]); // Danh sách tất cả permissions
  selectedRole = signal<RoleResponse | null>(null); // Role đang được chọn để sửa
  permissionForm!: FormGroup; // Form để quản lý checkboxes

  isLoadingRoles = signal(true);
  isLoadingPermissions = signal(true);
  isSaving = signal(false);
  errorMessage = signal<string | null>(null);

  getRoleText = getRoleTypeText; // Đưa helper vào component
  // Getter để kiểm tra trạng thái pristine của form
  get isFormPristine(): boolean {
    return this.permissionForm.pristine;
  }

  ngOnInit(): void {
    this.loadInitialData();
    this.initForm();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Load cả roles và permissions cùng lúc
  loadInitialData(): void {
    this.isLoadingRoles.set(true);
    this.isLoadingPermissions.set(true);
    this.errorMessage.set(null);

    forkJoin({ // Thực hiện nhiều lời gọi API song song
      roles: this.adminInteractionService.getAllRoles(),
      permissions: this.adminInteractionService.getAllPermissions()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ roles, permissions }) => {
          if (roles.success && roles.data) {
            this.roles.set(roles.data);
          } else {
            this.handleError(roles, 'Không tải được danh sách vai trò.');
          }
          if (permissions.success && permissions.data) {
            this.allPermissions.set(permissions.data);
            this.buildPermissionCheckboxes(); // Xây dựng form sau khi có permissions
          } else {
            this.handleError(permissions, 'Không tải được danh sách quyền hạn.');
          }
        },
        error: (err) => this.handleError(err, 'Lỗi khi tải dữ liệu phân quyền.'),
        complete: () => {
          this.isLoadingRoles.set(false);
          this.isLoadingPermissions.set(false);
        }
      });
  }

  initForm(): void {
    // Khởi tạo form rỗng ban đầu, sẽ build checkboxes sau khi có allPermissions
    this.permissionForm = this.fb.group({
      permissions: this.fb.array([]) // FormArray để chứa các FormControl của checkbox
    });
  }

  // Tạo các FormControl checkbox dựa trên danh sách allPermissions
  buildPermissionCheckboxes(): void {
    const permissionControls = this.allPermissions().map(permission =>
      this.fb.control(false) // Mặc định là false (chưa chọn)
    );
    this.permissionForm.setControl('permissions', this.fb.array(permissionControls));
  }

  // Lấy FormArray 'permissions'
  get permissionsFormArray(): FormArray {
    return this.permissionForm.get('permissions') as FormArray;
  }

  // Khi chọn một role để xem/sửa
  selectRole(role: RoleResponse): void {
    this.selectedRole.set(role);
    this.patchPermissionForm(role.permissionNames || []); // Điền trạng thái checkbox
  }

  // Bỏ chọn role
  deselectRole(): void {
    this.selectedRole.set(null);
    this.permissionForm.reset(); // Reset trạng thái checkbox
  }

  // Cập nhật trạng thái các checkbox dựa trên permissions của role được chọn
  patchPermissionForm(rolePermissions: string[]): void {
    const rolePermissionSet = new Set(rolePermissions);
    this.permissionsFormArray.controls.forEach((control, index) => {
      const permissionName = this.allPermissions()[index]?.name;
      if (permissionName) {
        control.setValue(rolePermissionSet.has(permissionName), { emitEvent: false }); // Set giá trị không trigger valueChanges
      }
    });
    this.permissionForm.markAsPristine(); // Đánh dấu form chưa thay đổi
  }

  // Lưu thay đổi permissions cho role
  savePermissions(): void {
    if (!this.selectedRole() || this.permissionForm.invalid) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    // Lấy danh sách tên các permission được chọn từ form
    const selectedPermissionNames = this.allPermissions()
      .filter((permission, index) => this.permissionsFormArray.at(index).value)
      .map(permission => permission.name);

    const requestData: RoleUpdateRequest = {
      permissionNames: selectedPermissionNames
    };

    const roleId = this.selectedRole()!.id; // Đã kiểm tra selectedRole() ở trên

    this.adminInteractionService.updateRolePermissions(roleId, requestData)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isSaving.set(false))
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            const updatedRoleData: RoleResponse = res.data; // Gán vào biến có kiểu rõ ràng
            this.toastr.success(`Cập nhật quyền cho vai trò "${this.getRoleText(updatedRoleData.name)}" thành công!`);
            this.roles.update(currentRoles => {
              const index = currentRoles.findIndex(r => r.id === roleId);
              if (index > -1) {
                currentRoles[index] = updatedRoleData; // *** Gán từ biến đã kiểm tra ***
              }
              return [...currentRoles];
            });
            this.selectedRole.set(updatedRoleData);
            this.patchPermissionForm(updatedRoleData.permissionNames || []);
          } else {
            this.handleError(res, 'Lỗi cập nhật quyền.');
          }
        },
        error: (err) => this.handleError(err, 'Lỗi cập nhật quyền.')
      });
  }

  // Helper xử lý lỗi
  private handleError(err: any, defaultMessage: string): void {
    const message = err?.message || defaultMessage;
    this.errorMessage.set(message);
    this.toastr.error(message);
    this.isLoadingRoles.set(false); // Đảm bảo tắt loading khi có lỗi
    this.isLoadingPermissions.set(false);
    this.isSaving.set(false);
    console.error(err);
  }

  trackRoleById(index: number, item: RoleResponse): number {
    return item.id;
  }
  trackPermissionByIndex(index: number, item: any): number { // Dùng index vì control không có ID
    return index;
  }
}
