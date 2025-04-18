import { Component, OnInit, inject, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, ActivatedRoute, Router } from '@angular/router'; // Import ActivatedRoute, Router
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
  @Output() categorySelected = new EventEmitter<number | null>(); // Emit ID category được chọn

  private categoryService = inject(CategoryService);
  private route = inject(ActivatedRoute); // Để lấy slug category hiện tại (nếu có)
  private router = inject(Router);

  categories = signal<CategoryResponse[]>([]);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  activeCategoryId = signal<number | null>(null); // ID của category đang active

  ngOnInit(): void {
    this.loadCategories();
    // Lắng nghe thay đổi route để cập nhật active category
    this.route.paramMap.subscribe(params => {
      const categorySlug = params.get('slug');
      if (categorySlug) {
        // Tìm ID tương ứng với slug (cần gọi API hoặc tìm trong list đã load)
        // Tạm thời reset khi có slug mới
        // this.setActiveCategoryBySlug(categorySlug);
      } else {
        this.activeCategoryId.set(null); // Không có slug -> không active category nào
      }
    });
  }



  loadCategories(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.categoryService.getCategoryTree().subscribe({
      next: (response: ApiResponse<CategoryResponse[]>) => {
        if (response.success && response.data) {
          this.categories.set(response.data);
          // Sau khi load xong, kiểm tra lại route để set active category
          const currentSlug = this.route.snapshot.paramMap.get('slug');
          if (currentSlug) {
            this.setActiveCategoryBySlug(currentSlug, response.data);
          }

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


  selectCategory(categoryId: number | null, categorySlug?: string): void {
    this.activeCategoryId.set(categoryId);
    this.categorySelected.emit(categoryId); // Emit ID ra ngoài

    // Điều hướng URL tương ứng
    if (categoryId && categorySlug) {
      this.router.navigate(['/categories', categorySlug]);
    } else {
      this.router.navigate(['/products']); // Quay về trang tất cả sản phẩm
    }
  }

  // Hàm đệ quy để hiển thị menu con (nếu cần)
  toggleSubmenu(event: Event): void {
    const element = event.currentTarget as HTMLElement;
    const submenu = element.nextElementSibling as HTMLElement;
    if (submenu && submenu.tagName === 'UL') {
      submenu.classList.toggle('hidden'); // Hoặc dùng class khác để animation
      element.querySelector('.submenu-arrow')?.classList.toggle('rotate-90');
    }
  }

  /**
   * Hàm kiểm tra xem category hiện tại hoặc một trong các category con của nó
   * có đang được active hay không. Dùng để quyết định mở <details>.
   * @param category Category cha cần kiểm tra.
   * @returns true nếu category cha hoặc con của nó đang active.
   */
  isCategoryOrChildActive(category: CategoryResponse): boolean { // *** THÊM HÀM NÀY ***
    const activeId = this.activeCategoryId();
    if (activeId === null) {
      return false;
    }
    if (category.id === activeId) {
      return true;
    }

    const checkChildren = (children: CategoryResponse[] | null | undefined): boolean => {
      if (!children || children.length === 0) {
        return false;
      }
      for (const child of children) {
        if (child.id === activeId) {
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
