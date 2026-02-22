import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';

@Component({
  selector: 'app-text-toolbar',
  templateUrl: './text-toolbar.component.html',
  styleUrls: ['./text-toolbar.component.css']
})
export class TextToolbarComponent implements OnInit, OnDestroy {
  visible = false;
  position = { top: 0, left: 0 };
  showBelow = false;
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
    if (this.selectionTimeout) {
      clearTimeout(this.selectionTimeout);
    }

    this.selectionTimeout = setTimeout(() => {
      this.updateToolbarPosition();
    }, 50);
  }

  updateToolbarPosition(): void {
    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0 || selection.toString().trim().length === 0) {
      this.visible = false;
      return;
    }

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const editableParent = this.findEditableParent(container);

    if (!editableParent) {
      this.visible = false;
      return;
    }

    const rect = range.getBoundingClientRect();
    
    if (rect.width === 0 && rect.height === 0) {
      this.visible = false;
      return;
    }

    // Toolbar dimensions
    const toolbarWidth = 420;
    const toolbarHeight = 50;
    const gap = 12;
    const viewportPadding = 10;

    // Calculate horizontal position (centered on selection)
    let left = rect.left + (rect.width / 2) - (toolbarWidth / 2);

    // Keep toolbar on screen horizontally
    if (left < viewportPadding) {
      left = viewportPadding;
    }
    if (left + toolbarWidth > window.innerWidth - viewportPadding) {
      left = window.innerWidth - toolbarWidth - viewportPadding;
    }

    // Calculate vertical position
    // rect.top and rect.bottom are relative to viewport
    const selectionTopInViewport = rect.top;
    const selectionBottomInViewport = rect.bottom;
    
    // Calculate space available
    const spaceAbove = selectionTopInViewport;
    const spaceBelow = window.innerHeight - selectionBottomInViewport;

    let top: number;
    let positionBelow = false;

    // Check if toolbar fits above selection
    if (spaceAbove >= (toolbarHeight + gap + viewportPadding)) {
      // Show above - enough space
      top = selectionTopInViewport - toolbarHeight - gap;
      positionBelow = false;
    } else {
      // Show below - not enough space above
      top = selectionBottomInViewport + gap;
      positionBelow = true;
    }

    // Ensure toolbar doesn't go below viewport
    if (top + toolbarHeight > window.innerHeight - viewportPadding) {
      top = window.innerHeight - toolbarHeight - viewportPadding;
    }

    // Ensure toolbar doesn't go above viewport
    if (top < viewportPadding) {
      top = viewportPadding;
    }

    this.position = { top, left };
    this.showBelow = positionBelow;
    this.visible = true;
  }

  findEditableParent(node: Node): HTMLElement | null {
    let current = node as HTMLElement;
    let depth = 0;
    const maxDepth = 20;
    
    while (current && current !== document.body && depth < maxDepth) {
      if (current.contentEditable === 'true' || current.isContentEditable) {
        return current;
      }
      current = current.parentElement as HTMLElement;
      depth++;
    }
    return null;
  }

  execCommand(command: string, value?: string): void {
    document.execCommand(command, false, value);
    this.preserveSelection();
  }

  createLink(): void {
    const selection = window.getSelection();
    if (!selection || selection.toString().length === 0) {
      alert('Please select some text first');
      return;
    }

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
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        this.updateToolbarPosition();
      }
    }, 10);
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    event.preventDefault();
  }
}