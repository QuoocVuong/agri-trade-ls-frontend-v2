import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageAllOrdersComponent } from './manage-all-orders.component';

describe('ManageAllOrdersComponent', () => {
  let component: ManageAllOrdersComponent;
  let fixture: ComponentFixture<ManageAllOrdersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageAllOrdersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageAllOrdersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
