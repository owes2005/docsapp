import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';

@Component({
  selector: 'app-text-toolbar',
  templateUrl: './text-toolbar.component.html',
  styleUrls: ['./text-toolbar.component.css']
})
export class TextToolbarComponent implements OnInit, OnDestroy {
  visible = false;
  position = { top: 0, left: 0 };
  private selectionTimeout: any;

  ngOnInit(): void {
    document.addEventListener('selectionchange', this.handleSelectionChange.bind(this));
  }

  ngOnDestroy(): void {
    document.removeEventListener('selectionchange', this.handleSelectionChange.bind(this));
    if (this.selectionTimeout) {
      clearTimeout(this.selectionTimeout);
    }
  }

  handleSelectionChange(): void {
    // Debounce to avoid excessive updates
    if (this.selectionTimeout) {
      clearTimeout(this.selectionTimeout);
    }

    this.selectionTimeout = setTimeout(() => {
      this.updateToolbarPosition();
    }, 50);
  }

  updateToolbarPosition(): void {
    const selection = window.getSelection();
    
    if (!selection || selection.toString().trim().length === 0) {
      this.visible = false;
      return;
    }

    // Check if selection is in an editable element
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const editableParent = this.findEditableParent(container);

    if (!editableParent) {
      this.visible = false;
      return;
    }

    // Get selection bounding box
    const rect = range.getBoundingClientRect();
    
    if (rect.width === 0 && rect.height === 0) {
      this.visible = false;
      return;
    }

    // Position toolbar above the selection
    const toolbarWidth = 300; // Approximate toolbar width
    const toolbarHeight = 45; // Approximate toolbar height
    
    let top = rect.top + window.scrollY - toolbarHeight - 8;
    let left = rect.left + window.scrollX + (rect.width / 2) - (toolbarWidth / 2);

    // Keep toolbar on screen
    const padding = 10;
    if (left < padding) {
      left = padding;
    }
    if (left + toolbarWidth > window.innerWidth - padding) {
      left = window.innerWidth - toolbarWidth - padding;
    }

    // If toolbar would be above viewport, show below selection
    if (top < window.scrollY + padding) {
      top = rect.bottom + window.scrollY + 8;
    }

    this.position = { top, left };
    this.visible = true;
  }

  findEditableParent(node: Node): HTMLElement | null {
    let current = node as HTMLElement;
    while (current && current !== document.body) {
      if (current.contentEditable === 'true' || current.isContentEditable) {
        return current;
      }
      current = current.parentElement as HTMLElement;
    }
    return null;
  }

  execCommand(command: string, value?: string): void {
    document.execCommand(command, false, value);
    this.preserveSelection();
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

  private preserveSelection(): void {
    // Keep toolbar visible after command
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        this.updateToolbarPosition();
      }
    }, 10);
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    // Prevent toolbar from disappearing when clicking it
    event.preventDefault();
  }
}
