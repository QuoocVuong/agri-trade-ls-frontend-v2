import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupplySourceDetailComponent } from './supply-source-detail.component';

describe('SupplySourceDetailComponent', () => {
  let component: SupplySourceDetailComponent;
  let fixture: ComponentFixture<SupplySourceDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupplySourceDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupplySourceDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
