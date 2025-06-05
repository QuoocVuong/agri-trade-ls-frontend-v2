import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupplyRegistrationFormComponent } from './supply-registration-form.component';

describe('SupplyRegistrationFormComponent', () => {
  let component: SupplyRegistrationFormComponent;
  let fixture: ComponentFixture<SupplyRegistrationFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupplyRegistrationFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupplyRegistrationFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
