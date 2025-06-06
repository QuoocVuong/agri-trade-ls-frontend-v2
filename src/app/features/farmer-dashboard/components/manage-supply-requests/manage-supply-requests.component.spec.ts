import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageSupplyRequestsComponent } from './manage-supply-requests.component';

describe('ManageSupplyRequestsComponent', () => {
  let component: ManageSupplyRequestsComponent;
  let fixture: ComponentFixture<ManageSupplyRequestsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageSupplyRequestsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageSupplyRequestsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
