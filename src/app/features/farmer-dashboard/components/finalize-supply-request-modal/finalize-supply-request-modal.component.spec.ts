import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FinalizeSupplyRequestModalComponent } from './finalize-supply-request-modal.component';

describe('FinalizeSupplyRequestModalComponent', () => {
  let component: FinalizeSupplyRequestModalComponent;
  let fixture: ComponentFixture<FinalizeSupplyRequestModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinalizeSupplyRequestModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FinalizeSupplyRequestModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
