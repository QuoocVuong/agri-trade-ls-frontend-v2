import {Component, OnInit, inject, signal, Output, EventEmitter, Input} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, ActivatedRoute, Router } from '@angular/router';
import { CategoryService } from '../../services/category.service';
import { CategoryResponse } from '../../dto/response/CategoryResponse';
import { ApiResponse } from '../../../../core/models/api-response.model';

@Component({
  selector: 'app-category-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './category-sidebar.component.html',
})
export class CategorySidebarComponent implements OnInit {
  @Output() categorySelected = new EventEmitter<string | null>(); // Emit ID category được chọn
  @Input() pageType: 'products' | 'supply-sources' = 'products'; // Mặc định là 'products'


  private categoryService = inject(CategoryService);
  private route = inject(ActivatedRoute); // Để lấy slug category hiện tại
  private router = inject(Router);

  categories = signal<CategoryResponse[]>([]);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  activeCategoryId = signal<number | null>(null); // ID của category đang active

  activeCategorySlug = signal<string | null>(null); // Slug của category đang active

  ngOnInit(): void {
    this.loadCategories();
    // Lắng nghe thay đổi route để cập nhật active category slug
    this.route.paramMap.subscribe(params => {
      const categorySlug = params.get('slug');
      this.activeCategorySlug.set(categorySlug); // Cập nhật active slug từ URL
    });
  }




  loadCategories(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.categoryService.getCategoryTree().subscribe({
      next: (response: ApiResponse<CategoryResponse[]>) => {
        if (response.success && response.data) {
          this.categories.set(response.data);

          const currentSlug = this.route.snapshot.paramMap.get('slug');
          this.activeCategorySlug.set(currentSlug);
        } else {
          this.errorMessage.set(response.message || 'Failed to load categories.');
        }
        this.isLoading.set(false);
      },
      error: (err: ApiResponse<null>) => {
        this.errorMessage.set(err.message || 'An error occurred.');
        this.isLoading.set(false);
      }
    });
  }

  // Tìm và set active category dựa vào slug từ URL
  setActiveCategoryBySlug(slug: string, categories: CategoryResponse[]): void {
    const findActive = (cats: CategoryResponse[]): CategoryResponse | null => {
      for(const cat of cats) {
        if (cat.slug === slug) return cat;
        if (cat.children && cat.children.length > 0) {
          const foundInChildren = findActive(cat.children);
          if (foundInChildren) return foundInChildren;
        }
      }
      return null;
    }
    const activeCat = findActive(categories);
    this.activeCategoryId.set(activeCat ? activeCat.id : null);
  }


  selectCategory(category: CategoryResponse | null): void {
    const targetSlug = category ? category.slug : null;
    this.activeCategorySlug.set(targetSlug);
    this.categorySelected.emit(targetSlug); // Vẫn emit slug như cũ

    // **ĐIỀU HƯỚNG DỰA TRÊN pageType**
    if (this.pageType === 'supply-sources') {
      if (targetSlug) {
        this.router.navigate(['/supply-sources/category', targetSlug], { queryParams: {} });
      } else {
        this.router.navigate(['/supply-sources'], { queryParams: {} });
      }
    } else { // Mặc định hoặc 'products'
      if (targetSlug) {
        this.router.navigate(['/categories', targetSlug], { queryParams: {} });
      } else {
        this.router.navigate(['/products'], { queryParams: {} });
      }
    }
  }

  // Hàm đệ quy để hiển thị menu con
  toggleSubmenu(event: Event): void {
    const element = event.currentTarget as HTMLElement;
    const submenu = element.nextElementSibling as HTMLElement;
    if (submenu && submenu.tagName === 'UL') {
      submenu.classList.toggle('hidden'); // Hoặc dùng class khác để animation
      element.querySelector('.submenu-arrow')?.classList.toggle('rotate-90');
    }
  }


  isCategoryOrChildActive(category: CategoryResponse): boolean {
    const currentActiveSlug = this.activeCategorySlug();
    if (currentActiveSlug === null) {
      return false;
    }
    if (category.slug === currentActiveSlug) {
      return true;
    }

    const checkChildren = (children: CategoryResponse[] | null | undefined): boolean => {
      if (!children || children.length === 0) {
        return false;
      }
      for (const child of children) {
        if (child.slug === currentActiveSlug) {
          return true;
        }
        if (child.children && child.children.length > 0) {
          if (checkChildren(child.children)) {
            return true;
          }
        }
      }
      return false;
    };
    return checkChildren(category.children);
  }

}
