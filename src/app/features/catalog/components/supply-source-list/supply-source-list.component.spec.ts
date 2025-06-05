import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupplySourceListComponent } from './supply-source-list.component';

describe('SupplySourceListComponent', () => {
  let component: SupplySourceListComponent;
  let fixture: ComponentFixture<SupplySourceListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupplySourceListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupplySourceListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
