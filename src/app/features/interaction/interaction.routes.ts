import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';


export const INTERACTION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/chat/chat-layout/chat-layout.component').then(m => m.ChatLayoutComponent),
    canActivate: [authGuard], // Chat yêu cầu đăng nhập
    title: 'Tin nhắn'
  },

];


