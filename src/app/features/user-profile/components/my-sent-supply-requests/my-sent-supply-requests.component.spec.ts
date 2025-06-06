import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MySentSupplyRequestsComponent } from './my-sent-supply-requests.component';

describe('MySentSupplyRequestsComponent', () => {
  let component: MySentSupplyRequestsComponent;
  let fixture: ComponentFixture<MySentSupplyRequestsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MySentSupplyRequestsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MySentSupplyRequestsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
