import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupplyOrderRequestFormComponent } from './supply-order-request-form.component';

describe('SupplyOrderRequestFormComponent', () => {
  let component: SupplyOrderRequestFormComponent;
  let fixture: ComponentFixture<SupplyOrderRequestFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupplyOrderRequestFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupplyOrderRequestFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
