import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditFarmerProfileComponent } from './edit-farmer-profile.component';

describe('EditFarmerProfileComponent', () => {
  let component: EditFarmerProfileComponent;
  let fixture: ComponentFixture<EditFarmerProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditFarmerProfileComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditFarmerProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
