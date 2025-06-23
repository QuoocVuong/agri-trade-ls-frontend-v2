// src/app/features/farmer-dashboard/components/farmer-reviews/farmer-reviews.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReviewListComponent } from '../../../interaction/components/review-list/review-list.component';


@Component({
  selector: 'app-farmer-reviews',
  standalone: true,
  imports: [CommonModule, ReviewListComponent],
  template: `
    <div class="container mx-auto px-4 py-6">
      <h1 class="text-2xl font-bold mb-6">Đánh giá Sản phẩm của bạn</h1>



      <app-review-list
        [mode]="'farmer_product_reviews'"
        [showAdminActions]="false">

      </app-review-list>
    </div>
  `,
})
export class FarmerReviewsComponent {

}
