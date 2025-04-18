import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FarmerStatsComponent } from './farmer-stats.component';

describe('FarmerStatsComponent', () => {
  let component: FarmerStatsComponent;
  let fixture: ComponentFixture<FarmerStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FarmerStatsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FarmerStatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
