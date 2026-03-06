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
  private savedRange: Range | null = null;
  private activeEditable: HTMLElement | null = null;
  private readonly selectionChangeHandler = this.handleSelectionChange.bind(this);

  ngOnInit(): void {
    document.addEventListener('selectionchange', this.selectionChangeHandler);
  }

  ngOnDestroy(): void {
    document.removeEventListener('selectionchange', this.selectionChangeHandler);
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
      this.savedRange = null;
      this.activeEditable = null;
      return;
    }

    const rect = this.getToolbarAnchorRect(editableParent, range);
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      this.visible = false;
      return;
    }

    this.savedRange = range.cloneRange();
    this.activeEditable = editableParent;

    // Toolbar dimensions
    const toolbarWidth = this.getToolbarWidth();
    const toolbarHeight = 50;
    const gap = 6;
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

  private getToolbarAnchorRect(editableParent: HTMLElement, range: Range): DOMRect | null {
    const contentBlock = editableParent.closest('.content-block') as HTMLElement | null;
    if (contentBlock) {
      const blockRect = contentBlock.getBoundingClientRect();
      if (blockRect.width > 0 && blockRect.height > 0) {
        return blockRect;
      }
    }

    const editableRect = editableParent.getBoundingClientRect();
    if (editableRect.width > 0 && editableRect.height > 0) {
      return editableRect;
    }

    return this.getSelectionAnchorRect(range);
  }

  private getSelectionAnchorRect(range: Range): DOMRect | null {
    const rects = Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0);
    if (rects.length === 0) {
      const fallback = range.getBoundingClientRect();
      return fallback.width > 0 || fallback.height > 0 ? fallback : null;
    }

    // Use the widest fragment on the first visual line.
    // This avoids list-marker/tiny fragments pulling the toolbar to the left.
    const top = Math.min(...rects.map(r => r.top));
    const topLineRects = rects.filter(r => Math.abs(r.top - top) < 1.5);
    const anchor = topLineRects.reduce((best, current) =>
      current.width > best.width ? current : best
    );

    return new DOMRect(anchor.left, anchor.top, anchor.width, anchor.height);
  }

  private getToolbarWidth(): number {
    const toolbarContent = document.querySelector('.text-toolbar .toolbar-content') as HTMLElement | null;
    if (toolbarContent) {
      return toolbarContent.getBoundingClientRect().width;
    }

    // Fallback for first render before toolbar is in DOM.
    return 180;
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
    this.restoreSelection();
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

  private restoreSelection(): void {
    const selection = window.getSelection();
    if (!selection || !this.savedRange) return;

    if (this.activeEditable) {
      this.activeEditable.focus();
    }

    selection.removeAllRanges();
    selection.addRange(this.savedRange);
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    event.preventDefault();
  }
}
