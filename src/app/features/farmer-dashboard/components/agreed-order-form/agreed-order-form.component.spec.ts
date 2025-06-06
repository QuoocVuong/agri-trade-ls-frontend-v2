import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgreedOrderFormComponent } from './agreed-order-form.component';

describe('AgreedOrderFormComponent', () => {
  let component: AgreedOrderFormComponent;
  let fixture: ComponentFixture<AgreedOrderFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgreedOrderFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AgreedOrderFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
