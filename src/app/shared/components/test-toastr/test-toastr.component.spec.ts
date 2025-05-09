import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestToastrComponent } from './test-toastr.component';

describe('TestToastrComponent', () => {
  let component: TestToastrComponent;
  let fixture: ComponentFixture<TestToastrComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestToastrComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TestToastrComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
