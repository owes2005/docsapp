import { Component, EventEmitter, Output, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-text-toolbar',
  templateUrl: './text-toolbar.component.html',
  styleUrls: ['./text-toolbar.component.css']
})
export class TextToolbarComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();

  visible = false;
  position = { top: 0, left: 0 };

  ngOnInit(): void {
    document.addEventListener('selectionchange', this.handleSelection.bind(this));
  }

  ngOnDestroy(): void {
    document.removeEventListener('selectionchange', this.handleSelection.bind(this));
  }

  handleSelection(): void {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      this.position = {
        top: rect.top - 50 + window.scrollY,
        left: rect.left + (rect.width / 2) - 150
      };
      this.visible = true;
    } else {
      this.visible = false;
    }
  }

  execCommand(command: string, value?: string): void {
    document.execCommand(command, false, value);
    this.restoreSelection();
  }

  createLink(): void {
    const url = prompt('Enter URL:');
    if (url) {
      this.execCommand('createLink', url);
    }
  }

  changeColor(color: string): void {
    this.execCommand('foreColor', color);
  }

  changeBackground(color: string): void {
    this.execCommand('backColor', color);
  }

  private restoreSelection(): void {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selection.collapseToEnd();
    }
  }
}