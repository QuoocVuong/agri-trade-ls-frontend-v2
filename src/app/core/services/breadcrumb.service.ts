// src/app/core/services/breadcrumb.service.ts
import { Injectable, signal } from '@angular/core';
import { ActivatedRouteSnapshot, Data, NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Breadcrumb } from '../models/breadcrumb.model';

@Injectable({
  providedIn: 'root'
})
export class BreadcrumbService {
  // Dùng BehaviorSubject để các component có thể subscribe và nhận giá trị mới
  private readonly _breadcrumbs$ = new BehaviorSubject<Breadcrumb[]>([]);

  // Public observable để các component khác sử dụng
  readonly breadcrumbs$ = this._breadcrumbs$.asObservable();

  constructor(private router: Router) {
    // Lắng nghe sự kiện NavigationEnd để biết khi nào route đã thay đổi xong
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(event => {
      // Khi route thay đổi, xây dựng lại breadcrumbs
      const root = this.router.routerState.snapshot.root;
      const breadcrumbs: Breadcrumb[] = this.createBreadcrumbs(root);
      this._breadcrumbs$.next(breadcrumbs);
    });
  }

  private createBreadcrumbs(route: ActivatedRouteSnapshot, url: string = '', breadcrumbs: Breadcrumb[] = []): Breadcrumb[] {
    const children: ActivatedRouteSnapshot[] = route.children;

    if (children.length === 0) {
      return breadcrumbs;
    }

    for (const child of children) {
      const routeURL: string = child.url.map(segment => segment.path).join('/');
      if (routeURL !== '') {
        url += `/${routeURL}`;
      }

      // Kiểm tra xem route có data và có thuộc tính breadcrumb không
      if (child.data['breadcrumb']) {
        const breadcrumb: Breadcrumb = {
          label: child.data['breadcrumb'],
          url: url
        };
        breadcrumbs.push(breadcrumb);
      }

      // Đệ quy để xử lý các route con
      return this.createBreadcrumbs(child, url, breadcrumbs);
    }

    return breadcrumbs; // Trả về mảng cuối cùng
  }
}
