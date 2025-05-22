import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean => {
  const authService = inject(AuthService);
  const router = inject(Router);
  // Lấy mảng các role mong muốn từ route data (linh hoạt hơn)
  const expectedRoles = route.data['expectedRoles'] as string[] | string | undefined;

  if (!expectedRoles || (Array.isArray(expectedRoles) && expectedRoles.length === 0)) {
    console.warn('RoleGuard: Expected roles not defined or empty in route data for', state.url);
    return true; // Cho phép nếu không yêu cầu role cụ thể
  }

  // AuthGuard nên chạy trước, nhưng kiểm tra lại cho chắc
  if (!authService.isAuthenticated()) {
    console.log('RoleGuard: User not authenticated, redirecting to login.');
    router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  const userRoles = authService.currentUser()?.roles || []; // Lấy roles của user hiện tại

  // Kiểm tra xem user có ít nhất một trong các role mong muốn không
  let hasRequiredRole = false;
  if (typeof expectedRoles === 'string') {
    hasRequiredRole = userRoles.includes(expectedRoles);
  } else if (Array.isArray(expectedRoles)) {
    hasRequiredRole = expectedRoles.some(role => userRoles.includes(role));
  }


  if (hasRequiredRole) {
    return true; // Cho phép truy cập
  } else {
    const requiredRolesString = Array.isArray(expectedRoles) ? expectedRoles.join(', ') : expectedRoles;
    console.log(`RoleGuard: User does not have required role(s) [${requiredRolesString}], redirecting.`);
    router.navigate(['/unauthorized']); // Điều hướng đến trang không có quyền
    return false; // Chặn truy cập
  }
};
