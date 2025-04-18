import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean => { // Trả về boolean trực tiếp vì dùng signal
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true; // Cho phép truy cập
  } else {
    // Chưa đăng nhập -> Điều hướng về login
    console.log('AuthGuard: User not authenticated, redirecting to login. Target:', state.url);
    router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
    return false; // Chặn truy cập
  }
};
