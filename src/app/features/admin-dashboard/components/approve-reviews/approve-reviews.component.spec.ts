import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApproveReviewsComponent } from './approve-reviews.component';

describe('ApproveReviewsComponent', () => {
  let component: ApproveReviewsComponent;
  let fixture: ComponentFixture<ApproveReviewsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApproveReviewsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApproveReviewsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
