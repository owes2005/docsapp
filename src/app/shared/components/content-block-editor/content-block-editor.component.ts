import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-content-block-editor',
  templateUrl: './content-block-editor.component.html',
  styleUrls: ['./content-block-editor.component.css']
})
export class ContentBlockEditorComponent {
  @Input() content = '';
  // Emits updated textarea value for parent-managed persistence.
  @Output() contentChange = new EventEmitter<string>();

  onContentChange(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.content = value;
    this.contentChange.emit(value);
  }
}
