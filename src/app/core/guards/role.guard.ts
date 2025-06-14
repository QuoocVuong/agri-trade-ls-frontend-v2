import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { map, catchError, switchMap } from 'rxjs/operators'; // Thêm switchMap
import { of, Observable } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { UserProfileService } from '../../features/user-profile/services/user-profile.service';
import { RoleType } from '../../common/model/role-type.enum';
import { VerificationStatus } from '../../common/model/verification-status.enum';
import { ConfirmationService } from '../../shared/services/confirmation.service';

/**
 * Guard để kiểm tra vai trò và các điều kiện truy cập đặc biệt.
 * @param route - Thông tin về route đang được truy cập.
 * @param state - Trạng thái của router.
 * @returns Observable<boolean> hoặc boolean để cho phép/chặn truy cập.
 */
export const roleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> | boolean => {
  // --- Dependency Injection ---
  // inject() được dùng để lấy các service cần thiết trong một functional guard.
  const authService = inject(AuthService);
  const router = inject(Router);
  const userProfileService = inject(UserProfileService);
  const confirmationService = inject(ConfirmationService);

  // --- Lấy thông tin cấu hình từ Route ---
  // Lấy danh sách các vai trò được phép truy cập route này, được định nghĩa trong `data` của route.
  const expectedRoles = route.data['expectedRoles'] as string[] | undefined;

  // Nếu route không yêu cầu vai trò cụ thể, cho phép truy cập ngay.
  if (!expectedRoles || expectedRoles.length === 0) {
    return true;
  }

  // --- Kiểm tra xác thực cơ bản ---
  // Luôn kiểm tra xem người dùng đã đăng nhập chưa.
  if (!authService.isAuthenticated()) {
    // Nếu chưa, điều hướng đến trang đăng nhập và mang theo URL họ đang muốn đến (returnUrl).
    router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
    return false; // Chặn truy cập.
  }

  // --- Kiểm tra vai trò cơ bản ---
  // Lấy danh sách vai trò của người dùng hiện tại từ AuthService.
  const userRoles = authService.currentUser()?.roles || [];
  // Kiểm tra xem người dùng có ít nhất một trong các vai trò được yêu cầu hay không.
  const hasRequiredRole = expectedRoles.some(role => userRoles.includes(role));

  // Nếu không có vai trò phù hợp, điều hướng đến trang "Không có quyền".
  if (!hasRequiredRole) {
    router.navigate(['/unauthorized']);
    return false; // Chặn truy cập.
  }

  // --- KIỂM TRA ĐIỀU KIỆN NÂNG CAO CHO VAI TRÒ FARMER ---
  // Nếu route này yêu cầu vai trò FARMER, chúng ta cần kiểm tra thêm trạng thái hồ sơ của họ.
  if (expectedRoles.includes(RoleType.FARMER)) {
    // Vì cần gọi API, guard sẽ trả về một Observable<boolean>.
    return userProfileService.getMyProfile().pipe(
      switchMap(response => { // Dùng switchMap để xử lý kết quả bất đồng bộ từ modal
        if (response.success && response.data?.farmerProfile) {
          const farmerProfile = response.data.farmerProfile;

          // **Trường hợp 1: Hồ sơ đã được duyệt**
          if (farmerProfile.verificationStatus === VerificationStatus.VERIFIED) {
            return of(true); // Trả về Observable<true>, cho phép truy cập.
          }
          // **Trường hợp 2: Hồ sơ chưa được duyệt hoặc bị từ chối**
          else {
            // Hiển thị modal thông báo thay vì alert().
            return confirmationService.open({
              title: 'Truy Cập Bị Hạn Chế',
              message: 'Hồ sơ nông dân của bạn đang chờ duyệt hoặc đã bị từ chối. Bạn chưa thể truy cập Kênh người bán.',
              confirmText: 'Về trang cá nhân',
              cancelText: 'Đóng', // Có thể đổi tên nút
              confirmButtonClass: 'btn-primary',
              iconClass: 'fas fa-info-circle',
              iconColorClass: 'text-info'
            }).pipe(
              map(confirmed => {
                if (confirmed) {
                  // Chỉ điều hướng khi người dùng nhấn "Xem hồ sơ"
                  router.navigate(['/user/profile']);
                }
                return false; // Luôn chặn truy cập trong trường hợp này.
              })
            );
          }
        }
        // **Trường hợp 3: Người dùng có vai trò FARMER nhưng chưa tạo hồ sơ**
        else {
          return confirmationService.open({
            title: 'Yêu Cầu Hồ Sơ Nông Dân',
            message: 'Bạn cần đăng ký và được duyệt hồ sơ nông dân để truy cập Kênh người bán.',
            confirmText: 'Đăng ký ngay',
            cancelText: 'Để sau',
            confirmButtonClass: 'btn-accent'
          }).pipe(
            map(confirmed => {
              if (confirmed) {
                // Nếu người dùng đồng ý, điều hướng đến trang tạo hồ sơ.
                router.navigate(['/user/profile/farmer-profile']);
              } else {
                if (confirmed) {
                  // Chỉ điều hướng khi người dùng nhấn "Đăng ký ngay"
                  router.navigate(['/user/profile/farmer-profile']);
                }
              }
              return false; // Luôn chặn truy cập trong trường hợp này.
            })
          );
        }
      }),
      catchError(() => {
        // **Trường hợp 4: Lỗi khi gọi API lấy profile**
        // Hiển thị modal thông báo lỗi.
        return confirmationService.open({
          title: 'Lỗi Hệ Thống',
          message: 'Có lỗi xảy ra khi kiểm tra thông tin hồ sơ của bạn. Vui lòng thử lại sau.',
          confirmText: 'Về trang cá nhân',
          cancelText: 'Đóng',
          confirmButtonClass: 'btn-error'
        }).pipe(
          map(() => {
            router.navigate(['/user/profile']); // Điều hướng về trang profile.
            return false; // Chặn truy cập.
          })
        );
      })
    );
  }

  // Nếu các điều kiện trên đều qua, và không phải là vai trò FARMER cần kiểm tra đặc biệt, cho phép truy cập.
  return true;
};
