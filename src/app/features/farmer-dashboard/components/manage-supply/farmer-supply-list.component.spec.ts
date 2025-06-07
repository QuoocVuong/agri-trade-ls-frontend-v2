import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FarmerSupplyListComponent } from './farmer-supply-list.component';

describe('FarmerSupplyListComponent', () => {
  let component: FarmerSupplyListComponent;
  let fixture: ComponentFixture<FarmerSupplyListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FarmerSupplyListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FarmerSupplyListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
