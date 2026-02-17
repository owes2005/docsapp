import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContentBlockEditorComponent } from './content-block-editor.component';

describe('ContentBlockEditorComponent', () => {
  let component: ContentBlockEditorComponent;
  let fixture: ComponentFixture<ContentBlockEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ContentBlockEditorComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ContentBlockEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
