import { Component, Input, OnInit, OnChanges, OnDestroy } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Page, ContentBlock, BlockType } from 'src/app/core/models/page.model';
import { PageService } from 'src/app/core/services/page.service';
import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { ImageViewerComponent } from 'src/app/shared/components/image-viewer/image-viewer.component';

type ListStyle = 'bulleted' | 'numbered';

interface BlockMenuItem {
  type: BlockType;
  icon: string;
  label: string;
  description: string;
  category: 'Basic' | 'Media';
  level?: number;
  listStyle?: ListStyle;
}

@Component({
  selector: 'app-block-editor',
  templateUrl: './block-editor.component.html',
  styleUrls: ['./block-editor.component.css'],
})
export class BlockEditorComponent implements OnInit, OnChanges, OnDestroy {
  @Input() page!: Page;

  blocks: ContentBlock[] = [];
  pageTitle = 'Untitled page';
  editingBlockId: string | null = null;
  showSlashMenu = false;
  slashMenuPosition = { top: 0, left: 0 };
  slashMenuSelectedIndex = 0;
  activeBlockId: string | null = null;
  filteredBlockTypes: BlockMenuItem[] = [];
  private slashRange: Range | null = null;
  private pendingBlockContent = new Map<string, string>();
  private saveTimeout: any;
  private scrollTimeout: any;
  private readonly saveDebounceMs = 400;
  private readonly scrollHandler = this.handleScroll.bind(this);

  blockTypes: BlockMenuItem[] = [
    {
      type: 'text',
      icon: 'text_fields',
      label: 'Text',
      description: 'Plain text block',
      category: 'Basic',
    },
    {
      type: 'heading',
      icon: 'title',
      label: 'Heading 1',
      description: 'Large section heading',
      category: 'Basic',
      level: 1,
    },
    {
      type: 'heading',
      icon: 'title',
      label: 'Heading 2',
      level: 2,
      description: 'Medium section heading',
      category: 'Basic',
    },
    {
      type: 'heading',
      icon: 'title',
      label: 'Heading 3',
      level: 3,
      description: 'Small section heading',
      category: 'Basic',
    },
    {
      type: 'image',
      icon: 'image',
      label: 'Image',
      description: 'Upload or embed image',
      category: 'Media',
    },
    {
      type: 'gallery',
      icon: 'collections',
      label: 'Image Gallery',
      description: 'Multiple images in grid',
      category: 'Media',
    },
    {
      type: 'divider',
      icon: 'horizontal_rule',
      label: 'Divider',
      description: 'Visual separator',
      category: 'Basic',
    },
    {
      type: 'text',
      icon: 'format_list_bulleted',
      label: 'Bulleted List',
      description: 'Create a bulleted list',
      category: 'Basic',
      listStyle: 'bulleted',
    },
    {
      type: 'text',
      icon: 'format_list_numbered',
      label: 'Numbered List',
      description: 'Create a numbered list',
      category: 'Basic',
      listStyle: 'numbered',
    },
  ];

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private pageService: PageService,
  ) {}

  ngOnInit(): void {
    if (this.page) {
      this.loadPageData();
    }

    // Listen for scroll events to reposition menu
    window.addEventListener('scroll', this.scrollHandler, true);
  }

  ngOnChanges(changes: any): void {
    if (changes.page && changes.page.currentValue) {
      this.loadPageData();
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.scrollHandler, true);
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
  }

  loadPageData(): void {
    // Deep clone to ensure independent data
    const pageCopy = JSON.parse(JSON.stringify(this.page));
    this.pageTitle = pageCopy.title || 'Untitled page';
    this.blocks = pageCopy.content?.blocks || [];

    // Ensure each block has required properties
    this.blocks.forEach((block, index) => {
      if (!block.id) block.id = 'block' + Date.now() + index;
      if (block.order === undefined) block.order = index;
    });

    // Sort blocks by order
    this.blocks.sort((a, b) => a.order - b.order);
    this.pendingBlockContent.clear();
  }

  updatePageTitle(event: any): void {
    const target = event.target as HTMLElement;

    // For title, we still use textContent (no formatting in title)
    this.pageTitle = target.textContent || '';
    this.savePage();
  }

  addBlock(
    type: BlockType | string,
    level?: number,
    listStyle?: ListStyle,
  ): void {
    const listContent =
      listStyle === 'bulleted'
        ? '<ul><li></li></ul>'
        : listStyle === 'numbered'
          ? '<ol><li></li></ol>'
          : '';

    const newBlock: ContentBlock = {
      id: 'block' + Date.now(),
      type: type as BlockType,
      content: listContent,
      order: this.blocks.length,
    };

    if (type === 'heading') {
      newBlock.level = level ?? 1;
    }

    this.blocks.push(newBlock);
    this.showSlashMenu = false;
    this.editingBlockId = newBlock.id;
    this.savePage();
  }

  updateBlock(blockId: string, event: any): void {
    const target = event.target as HTMLElement;

    // Get innerHTML instead of textContent to preserve formatting
    const content = this.normalizeEditableHtml(target.innerHTML || '');

    const block = this.blocks.find((b) => b.id === blockId);
    if (block) {
      block.content = content;
      this.pendingBlockContent.delete(blockId);
      if (event?.type === 'input') {
        this.debouncedSavePage();
      } else {
        this.savePage();
      }
    }
  }

  onBlockInput(blockId: string, event: any): void {
    const target = event.target as HTMLElement;
    const content = this.normalizeEditableHtml(target.innerHTML || '');
    this.pendingBlockContent.set(blockId, content);
    this.debouncedSavePage();
  }

  deleteBlock(blockId: string): void {
    this.blocks = this.blocks.filter((b) => b.id !== blockId);
    this.reorderBlocks();
    this.savePage();
  }

  duplicateBlock(blockId: string): void {
    const block = this.blocks.find((b) => b.id === blockId);
    if (block) {
      const duplicate: ContentBlock = {
        ...JSON.parse(JSON.stringify(block)), // Deep clone
        id: 'block' + Date.now(),
        order: block.order + 1,
      };
      this.blocks.splice(block.order + 1, 0, duplicate);
      this.reorderBlocks();
      this.savePage();
    }
  }

  insertBlockBelow(blockId: string): void {
    const block = this.blocks.find((b) => b.id === blockId);
    if (!block) return;

    const newBlock: ContentBlock = {
      id: 'block' + Date.now(),
      type: 'text',
      content: '',
      order: block.order + 1,
    };

    this.blocks.splice(block.order + 1, 0, newBlock);
    this.reorderBlocks();
    this.savePage();

    // Focus the new block
    setTimeout(() => {
      const newElement = document.querySelector(
        `[data-block-id="${newBlock.id}"]`,
      );
      if (newElement) {
        (newElement as HTMLElement).focus();
      }
    }, 100);
  }

  applyListToBlock(blockId: string, listStyle: ListStyle): void {
    const block = this.blocks.find((b) => b.id === blockId);
    if (!block) return;

    block.type = 'text';
    block.content =
      listStyle === 'bulleted' ? '<ul><li></li></ul>' : '<ol><li></li></ol>';
    this.savePage();

    setTimeout(() => {
      const newElement = document.querySelector(
        `[data-block-id="${block.id}"]`,
      );
      if (newElement) {
        (newElement as HTMLElement).focus();
      }
    }, 100);
  }

  dropBlock(event: CdkDragDrop<ContentBlock[]>): void {
    moveItemInArray(this.blocks, event.previousIndex, event.currentIndex);
    this.reorderBlocks();
    this.savePage();
  }

  reorderBlocks(): void {
    this.blocks.forEach((block, index) => {
      block.order = index;
    });
  }

  onKeyDown(event: KeyboardEvent, blockId: string): void {
    this.activeBlockId = blockId;

    // Handle slash command
    if (event.key === '/' && !this.showSlashMenu) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (this.shouldOpenSlashMenu(range)) {
          setTimeout(() => this.openSlashMenu(event.target as HTMLElement), 0);
          return;
        }
      }
    }

    if (this.showSlashMenu) {
      this.handleSlashMenuKeyboard(event);
      return;
    }

    if (event.key === 'Escape') {
      this.showSlashMenu = false;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      const block = this.blocks.find((b) => b.id === blockId);
      if (block && block.type === 'heading') {
        event.preventDefault();
        this.createBlockAfter(blockId, 'text');
      }
    }
  }

  openSlashMenu(element?: HTMLElement): void {
    void element;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    // Store the current range
    this.slashRange = selection.getRangeAt(0).cloneRange();

    // Get cursor position
    const range = selection.getRangeAt(0);
    const rangeRect = this.getRangeRect(range);

    let top: number;
    let left: number;
    top = rangeRect.bottom + 8;
    left = rangeRect.left;

    // Menu dimensions
    const menuWidth = 320;
    const menuHeight = 400;

    // Prevent menu from going off-screen horizontally
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }
    if (left < 10) left = 10;

    // If menu would go below viewport, show above cursor
    const spaceBelow = window.innerHeight - rangeRect.bottom;
    if (spaceBelow < menuHeight && rangeRect.top > menuHeight) {
      top = rangeRect.top - menuHeight - 8;
    }
    if (top < 10) top = 10;
    if (top + menuHeight > window.innerHeight - 10) {
      top = window.innerHeight - menuHeight - 10;
    }

    this.slashMenuPosition = {
      top: top,
      left: left,
    };

    this.slashMenuSelectedIndex = 0;
    this.filteredBlockTypes = [...this.blockTypes];
    this.showSlashMenu = true;
  }

  handleScroll(): void {
    if (this.showSlashMenu) {
      // Debounce scroll updates
      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
      }

      this.scrollTimeout = setTimeout(() => {
        this.updateMenuPosition();
      }, 10);
    }
  }

  updateMenuPosition(): void {
    if (!this.slashRange || !this.showSlashMenu) return;
    const rangeRect = this.getRangeRect(this.slashRange);

    let top: number;
    let left: number;
    top = rangeRect.bottom + 8;
    left = rangeRect.left;

    const menuWidth = 320;
    const menuHeight = 400;

    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }
    if (left < 10) left = 10;

    const spaceBelow = window.innerHeight - rangeRect.bottom;
    if (spaceBelow < menuHeight && rangeRect.top > menuHeight) {
      top = rangeRect.top - menuHeight - 8;
    }
    if (top < 10) top = 10;
    if (top + menuHeight > window.innerHeight - 10) {
      top = window.innerHeight - menuHeight - 10;
    }

    this.slashMenuPosition = {
      top: top,
      left: left,
    };
  }

  handleSlashMenuKeyboard(event: KeyboardEvent): void {
    if (!this.filteredBlockTypes.length) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.slashMenuSelectedIndex =
          (this.slashMenuSelectedIndex + 1) % this.filteredBlockTypes.length;
        this.scrollMenuIntoView();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.slashMenuSelectedIndex =
          (this.slashMenuSelectedIndex - 1 + this.filteredBlockTypes.length) %
          this.filteredBlockTypes.length;
        this.scrollMenuIntoView();
        break;

      case 'Enter':
        event.preventDefault();
        const selected = this.filteredBlockTypes[this.slashMenuSelectedIndex];
        if (selected) {
          this.insertBlockType(selected.type, selected.level, selected.listStyle);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.closeSlashMenu(true);
        break;

      case 'Backspace':
        // Close menu and let backspace delete the /
        this.closeSlashMenu(false);
        break;

      default:
        // No search mode in slash menu; close and continue typing.
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          this.closeSlashMenu(true);
        }
    }
  }

  scrollMenuIntoView(): void {
    setTimeout(() => {
      const selectedItem = document.querySelector('.slash-menu-item.selected');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }

  createBlockAfter(afterBlockId: string, type: BlockType): void {
    const afterBlock = this.blocks.find((b) => b.id === afterBlockId);
    if (!afterBlock) return;

    const newBlock: ContentBlock = {
      id: 'block' + Date.now(),
      type: type,
      content: '',
      order: afterBlock.order + 1,
    };

    this.blocks.splice(afterBlock.order + 1, 0, newBlock);
    this.reorderBlocks();
    this.editingBlockId = newBlock.id;
    this.savePage();

    setTimeout(() => {
      const newElement = document.querySelector(
        `[data-block-id="${newBlock.id}"]`,
      );
      if (newElement) {
        (newElement as HTMLElement).focus();
      }
    }, 100);
  }

  insertBlockType(
    type: BlockType,
    level?: number,
    listStyle?: ListStyle,
  ): void {
    const listContent =
      listStyle === 'bulleted'
        ? '<ul><li></li></ul>'
        : listStyle === 'numbered'
          ? '<ol><li></li></ol>'
          : '';

    // Remove the slash and any typed filter text
    if (this.slashRange) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(this.slashRange);

        // Find and remove the /command text
        const container = this.slashRange.startContainer;
        if (container.nodeType === Node.TEXT_NODE && container.textContent) {
          const cursorPos = this.slashRange.startOffset;
          const text = container.textContent;

          // Find the position of the / before cursor
          const slashPos = text.lastIndexOf('/', cursorPos);

          if (slashPos !== -1) {
            // Remove from / to cursor position
            const beforeSlash = text.substring(0, slashPos);
            const afterCursor = text.substring(cursorPos);
            container.textContent = beforeSlash + afterCursor;

            // Set cursor position
            const range = document.createRange();
            range.setStart(container, slashPos);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
    }

    // Close menu
    this.closeSlashMenu(false);

    // If current block is empty, convert it
    if (this.activeBlockId) {
      const activeBlock = this.blocks.find((b) => b.id === this.activeBlockId);
      if (activeBlock) {
        const element = document.querySelector(
          `[data-block-id="${this.activeBlockId}"]`,
        ) as HTMLElement;
        const isEmpty =
          !element?.textContent?.trim() || element?.innerHTML === '<br>';

        if (isEmpty) {
          activeBlock.type = type;
          if (level) activeBlock.level = level;
          activeBlock.content = listContent;
          this.savePage();

          // Focus the block
          setTimeout(() => {
            if (element) {
              element.focus();
            }
          }, 50);
          return;
        }
      }
    }

    // Otherwise create new block below
    if (this.activeBlockId) {
      const activeBlock = this.blocks.find((b) => b.id === this.activeBlockId);
      if (activeBlock) {
        const newBlock: ContentBlock = {
          id: 'block' + Date.now(),
          type: type,
          content: listContent,
          order: activeBlock.order + 1,
        };

        if (level) newBlock.level = level;

        this.blocks.splice(activeBlock.order + 1, 0, newBlock);
        this.reorderBlocks();
        this.savePage();

        setTimeout(() => {
          const newElement = document.querySelector(
            `[data-block-id="${newBlock.id}"]`,
          );
          if (newElement) {
            (newElement as HTMLElement).focus();
          }
        }, 100);
      }
    }
  }

  closeSlashMenu(keepSlash: boolean): void {
    if (!keepSlash && this.slashRange) {
      // Remove the / character
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(this.slashRange);

        const container = this.slashRange.startContainer;
        if (container.nodeType === Node.TEXT_NODE && container.textContent) {
          const cursorPos = this.slashRange.startOffset;
          const text = container.textContent;
          const slashPos = text.lastIndexOf('/', cursorPos);

          if (slashPos !== -1) {
            const beforeSlash = text.substring(0, slashPos);
            const afterSlash = text.substring(slashPos + 1);
            container.textContent = beforeSlash + afterSlash;

            const range = document.createRange();
            range.setStart(container, slashPos);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
    }

    this.showSlashMenu = false;
    this.slashRange = null;
  }

  //Image logic
  uploadImage(event: any, blockId: string): void {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        alert('Image size should be less than 100MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e: any) => {
        const block = this.blocks.find((b) => b.id === blockId);
        if (block) {
          block.imageUrl = e.target.result;
          this.savePage();
        }
      };
      reader.readAsDataURL(file);
    }
  }

  uploadImageFromUrl(blockId: string): void {
    const url = prompt('Enter image URL (direct link to image):');
    if (url) {
      if (
        url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) ||
        url.includes('http')
      ) {
        const block = this.blocks.find((b) => b.id === blockId);
        if (block) {
          block.imageUrl = url;
          this.savePage();
        }
      } else {
        alert('Please enter a valid image URL');
      }
    }
  }

  changeImage(blockId: string): void {
    const block = this.blocks.find((b) => b.id === blockId);
    if (!block) return;

    block.imageUrl = '';
    this.savePage();
  }

  openImageViewer(imageUrl: string, caption?: string): void {
    this.dialog.open(ImageViewerComponent, {
      data: {
        imageUrl: imageUrl,
        caption: caption,
      },
      panelClass: 'image-viewer-dialog',
      maxWidth: '100vw',
      maxHeight: '100vh',
      width: '100%',
      height: '100%',
      hasBackdrop: true,
      backdropClass: 'image-viewer-backdrop',
    });
  }

  addImageToGallery(blockId: string, event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const block = this.blocks.find((b) => b.id === blockId);
        if (block) {
          if (!block.content) {
            block.content = [] as any;
          }
          if (Array.isArray(block.content)) {
            block.content.push({
              url: e.target.result,
              caption: '',
            } as any);
          }
          this.savePage();
        }
      };
      reader.readAsDataURL(file);
    }
  }

  handleKeyboardShortcut(event: KeyboardEvent): void {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdKey = isMac ? event.metaKey : event.ctrlKey;

    if (!cmdKey) return;

    switch (event.key.toLowerCase()) {
      case 'b':
        event.preventDefault();
        document.execCommand('bold');
        break;
      case 'i':
        event.preventDefault();
        document.execCommand('italic');
        break;
      case 'u':
        event.preventDefault();
        document.execCommand('underline');
        break;
      case 'k':
        event.preventDefault();
        const url = prompt('Enter URL:');
        if (url) {
          document.execCommand('createLink', false, url);
        }
        break;
    }
  }

  savePage(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    if (this.page) {
      const updatedPage: Partial<Page> = {
        title: this.pageTitle,
        content: {
          blocks: this.blocks.map((block) => ({
            id: block.id,
            type: block.type,
            content: this.pendingBlockContent.has(block.id)
              ? this.pendingBlockContent.get(block.id)
              : block.content,
            order: block.order,
            level: block.level,
            imageUrl: block.imageUrl,
            imageCaption: block.imageCaption,
          })),
        },
      };

      this.pageService.updatePage(this.page.id, updatedPage).subscribe(
        (updated) => {
          console.log('Page saved successfully');
        },
        (error) => {
          console.error('Error saving page:', error);
        },
      );
    }
  }

  private debouncedSavePage(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.savePage();
    }, this.saveDebounceMs);
  }

  private normalizeEditableHtml(html: string): string {
    const normalized = html.replace(/\u00a0/g, ' ').trim();

    if (
      normalized === '<br>' ||
      normalized === '<div><br></div>' ||
      normalized === '<p><br></p>'
    ) {
      return '';
    }

    return normalized;
  }

  private shouldOpenSlashMenu(range: Range): boolean {
    const editable = this.findEditableContainer(range);
    if (!editable) return false;
    // Open only when slash is typed as the very first character of a block.
    return this.getCaretOffsetWithin(editable, range) === 0;
  }

  private findEditableContainer(range: Range): HTMLElement | null {
    const startNode = range.startContainer as Node;
    const element =
      startNode.nodeType === Node.ELEMENT_NODE
        ? (startNode as HTMLElement)
        : startNode.parentElement;
    if (!element) return null;
    return element.closest('[data-block-id]') as HTMLElement | null;
  }

  private getCaretOffsetWithin(container: HTMLElement, range: Range): number {
    const preRange = range.cloneRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    return (preRange.toString() || '').length;
  }

  private getRangeRect(range: Range): DOMRect {
    const rect = range.getBoundingClientRect();
    if (rect.width !== 0 || rect.height !== 0) {
      return rect;
    }

    // For collapsed/empty caret positions where rect can be zero, use marker span.
    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    marker.style.position = 'relative';
    marker.style.display = 'inline-block';
    marker.style.width = '0';
    marker.style.overflow = 'hidden';

    const tempRange = range.cloneRange();
    tempRange.insertNode(marker);
    const markerRect = marker.getBoundingClientRect();
    marker.remove();

    return markerRect;
  }
}
