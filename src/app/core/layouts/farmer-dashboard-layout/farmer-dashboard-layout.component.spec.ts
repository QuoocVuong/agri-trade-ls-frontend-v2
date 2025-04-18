import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FarmerDashboardLayoutComponent } from './farmer-dashboard-layout.component';

describe('FarmerDashboardLayoutComponent', () => {
  let component: FarmerDashboardLayoutComponent;
  let fixture: ComponentFixture<FarmerDashboardLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FarmerDashboardLayoutComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FarmerDashboardLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
