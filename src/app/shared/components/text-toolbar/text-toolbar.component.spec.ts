import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TextToolbarComponent } from './text-toolbar.component';

describe('TextToolbarComponent', () => {
  let component: TextToolbarComponent;
  let fixture: ComponentFixture<TextToolbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TextToolbarComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TextToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
