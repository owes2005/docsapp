import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Page, ContentBlock, BlockType } from 'src/app/core/models/page.model';
import { PageService } from 'src/app/core/services/page.service';
import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { ImageViewerComponent } from 'src/app/shared/components/image-viewer/image-viewer.component';

@Component({
  selector: 'app-block-editor',
  templateUrl: './block-editor.component.html',
  styleUrls: ['./block-editor.component.css']
})
export class BlockEditorComponent implements OnInit, OnChanges {
  @Input() page!: Page;

  blocks: ContentBlock[] = [];
  pageTitle = 'Untitled page';
  editingBlockId: string | null = null;
  showSlashMenu = false;
  slashMenuPosition = { top: 0, left: 0 };
  slashMenuFilter = '';
  slashMenuSelectedIndex = 0;
  activeBlockId: string | null = null;

  blockTypes = [
    { 
      type: 'text', 
      icon: 'text_fields', 
      label: 'Text', 
      description: 'Plain text block',
      category: 'Basic'
    },
    { 
      type: 'heading', 
      icon: 'title', 
      label: 'Heading 1', 
      description: 'Large section heading',
      category: 'Basic',
      level: 1
    },
    { 
      type: 'heading', 
      icon: 'title', 
      label: 'Heading 2',
      level: 2,
      description: 'Medium section heading',
      category: 'Basic'
    },
    { 
      type: 'heading', 
      icon: 'title', 
      label: 'Heading 3',
      level: 3,
      description: 'Small section heading',
      category: 'Basic'
    },
    { 
      type: 'image', 
      icon: 'image', 
      label: 'Image', 
      description: 'Upload or embed image',
      category: 'Media'
    },
    { 
      type: 'gallery', 
      icon: 'collections', 
      label: 'Image Gallery', 
      description: 'Multiple images in grid',
      category: 'Media'
    },
    { 
      type: 'divider', 
      icon: 'horizontal_rule', 
      label: 'Divider', 
      description: 'Visual separator',
      category: 'Basic'
    },
    { 
      type: 'code', 
      icon: 'code', 
      label: 'Code', 
      description: 'Code block with syntax',
      category: 'Advanced'
    },
    { 
      type: 'quote', 
      icon: 'format_quote', 
      label: 'Quote', 
      description: 'Highlighted quotation',
      category: 'Basic'
    }
  ];

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private pageService: PageService
  ) {}

  ngOnInit(): void {
    if (this.page) {
      this.loadPageData();
    }
  }

  ngOnChanges(changes: any): void {
    if (changes.page && changes.page.currentValue) {
      this.loadPageData();
    }
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
  }

  updatePageTitle(event: any): void {
    const target = event.target as HTMLElement;
    
    // For title, we still use textContent (no formatting in title)
    this.pageTitle = target.textContent || '';
    this.savePage();
  }

  addBlock(type: BlockType | string, ...args: Array<number | undefined>): void {
    const level = args[0];
    const newBlock: ContentBlock = {
      id: 'block' + Date.now(),
      type: type as BlockType,
      content: '',
      order: this.blocks.length
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
    
    const block = this.blocks.find(b => b.id === blockId);
    if (block) {
      block.content = content;
      this.savePage();
    }
  }

  deleteBlock(blockId: string): void {
    this.blocks = this.blocks.filter(b => b.id !== blockId);
    this.reorderBlocks();
    this.savePage();
  }

  duplicateBlock(blockId: string): void {
    const block = this.blocks.find(b => b.id === blockId);
    if (block) {
      const duplicate: ContentBlock = {
        ...JSON.parse(JSON.stringify(block)), // Deep clone
        id: 'block' + Date.now(),
        order: block.order + 1
      };
      this.blocks.splice(block.order + 1, 0, duplicate);
      this.reorderBlocks();
      this.savePage();
    }
  }

  insertBlockBelow(blockId: string): void {
    const block = this.blocks.find(b => b.id === blockId);
    if (!block) return;

    const newBlock: ContentBlock = {
      id: 'block' + Date.now(),
      type: 'text',
      content: '',
      order: block.order + 1
    };

    this.blocks.splice(block.order + 1, 0, newBlock);
    this.reorderBlocks();
    this.savePage();

    // Focus the new block
    setTimeout(() => {
      const newElement = document.querySelector(`[data-block-id="${newBlock.id}"]`);
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
    
    if (event.key === '/') {
      setTimeout(() => {
        this.showSlashMenu = true;
        this.slashMenuFilter = '';
        this.slashMenuSelectedIndex = 0;
        this.positionSlashMenu(event.target as HTMLElement);
      }, 0);
    } 
    else if (this.showSlashMenu) {
      this.handleSlashMenuKeyboard(event);
    }
    else if (event.key === 'Escape') {
      this.showSlashMenu = false;
    }
    else if (event.key === 'Enter' && !event.shiftKey) {
      const block = this.blocks.find(b => b.id === blockId);
      if (block && block.type === 'heading') {
        event.preventDefault();
        this.createBlockAfter(blockId, 'text');
      }
    }
  }

  handleSlashMenuKeyboard(event: KeyboardEvent): void {
    const filteredTypes = this.getFilteredBlockTypes();
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.slashMenuSelectedIndex = Math.min(
          this.slashMenuSelectedIndex + 1, 
          filteredTypes.length - 1
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.slashMenuSelectedIndex = Math.max(this.slashMenuSelectedIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        const selected = filteredTypes[this.slashMenuSelectedIndex];
        if (selected) {
          this.insertBlockType(selected.type, selected.level);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.showSlashMenu = false;
        break;
      default:
        if (event.key.length === 1) {
          this.slashMenuFilter += event.key;
          this.slashMenuSelectedIndex = 0;
        } else if (event.key === 'Backspace' && this.slashMenuFilter) {
          this.slashMenuFilter = this.slashMenuFilter.slice(0, -1);
          this.slashMenuSelectedIndex = 0;
        }
    }
  }

  getFilteredBlockTypes(): any[] {
    if (!this.slashMenuFilter) {
      return this.blockTypes;
    }
    return this.blockTypes.filter(bt => 
      bt.label.toLowerCase().includes(this.slashMenuFilter.toLowerCase()) ||
      bt.description.toLowerCase().includes(this.slashMenuFilter.toLowerCase())
    );
  }

  positionSlashMenu(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    this.slashMenuPosition = {
      top: rect.bottom + window.scrollY + 5,
      left: rect.left + window.scrollX
    };
  }

  createBlockAfter(afterBlockId: string, type: BlockType): void {
    const afterBlock = this.blocks.find(b => b.id === afterBlockId);
    if (!afterBlock) return;

    const newBlock: ContentBlock = {
      id: 'block' + Date.now(),
      type: type,
      content: '',
      order: afterBlock.order + 1
    };

    this.blocks.splice(afterBlock.order + 1, 0, newBlock);
    this.reorderBlocks();
    this.editingBlockId = newBlock.id;
    this.savePage();
    
    setTimeout(() => {
      const newElement = document.querySelector(`[data-block-id="${newBlock.id}"]`);
      if (newElement) {
        (newElement as HTMLElement).focus();
      }
    }, 100);
  }

  insertBlockType(type: BlockType, level?: number): void {
    if (this.activeBlockId) {
      const activeBlock = this.blocks.find(b => b.id === this.activeBlockId);
      if (activeBlock && !activeBlock.content) {
        activeBlock.type = type;
        if (level) activeBlock.level = level;
        this.showSlashMenu = false;
        this.savePage();
        return;
      }
    }
    
    const newBlock: ContentBlock = {
      id: 'block' + Date.now(),
      type: type,
      content: '',
      order: this.blocks.length
    };

    if (level) newBlock.level = level;

    this.blocks.push(newBlock);
    this.showSlashMenu = false;
    this.editingBlockId = newBlock.id;
    this.savePage();
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
        const block = this.blocks.find(b => b.id === blockId);
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
      if (url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || url.includes('http')) {
        const block = this.blocks.find(b => b.id === blockId);
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
    const block = this.blocks.find(b => b.id === blockId);
    if (!block) return;
    
    block.imageUrl = '';
    this.savePage();
  }

  openImageViewer(imageUrl: string, caption?: string): void {
    this.dialog.open(ImageViewerComponent, {
      data: {
        imageUrl: imageUrl,
        caption: caption
      },
      panelClass: 'image-viewer-dialog',
      maxWidth: '100vw',
      maxHeight: '100vh',
      width: '100%',
      height: '100%',
      hasBackdrop: true,
      backdropClass: 'image-viewer-backdrop'
    });
  }

  addImageToGallery(blockId: string, event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const block = this.blocks.find(b => b.id === blockId);
        if (block) {
          if (!block.content) {
            block.content = [] as any;
          }
          if (Array.isArray(block.content)) {
            block.content.push({
              url: e.target.result,
              caption: ''
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
    if (this.page) {
      const updatedPage: Partial<Page> = {
        title: this.pageTitle,
        content: {
          blocks: this.blocks.map(block => ({
            id: block.id,
            type: block.type,
            content: block.content,
            order: block.order,
            level: block.level,
            imageUrl: block.imageUrl,
            imageCaption: block.imageCaption
          }))
        }
      };

      this.pageService.updatePage(this.page.id, updatedPage).subscribe(
        updated => {
          console.log('Page saved successfully');
        },
        error => {
          console.error('Error saving page:', error);
        }
      );
    }
  }

  private normalizeEditableHtml(html: string): string {
    const normalized = html
      .replace(/\u00a0/g, ' ')
      .trim();

    if (
      normalized === '<br>' ||
      normalized === '<div><br></div>' ||
      normalized === '<p><br></p>'
    ) {
      return '';
    }

    return normalized;
  }
}
