import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { DocumentService } from 'src/app/core/services/document.service';
import { PageService } from 'src/app/core/services/page.service';
import { Document } from 'src/app/core/models/document.model';
import { Page } from 'src/app/core/models/page.model';

@Component({
  selector: 'app-document-editor',
  templateUrl: './document-editor.component.html',
  styleUrls: ['./document-editor.component.css']
})
export class DocumentEditorComponent implements OnInit {

  document: Document | null = null;
  pages: Page[] = [];
  selectedPage: Page | null = null;
  currentDocumentId: string | null = null;
  renamingPageId: string | null = null;
  renamingPageTitle = '';
  sidebarOpen = true; // ADD THIS

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private documentService: DocumentService,
    private pageService: PageService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const documentId = params['documentId'];
      this.currentDocumentId = documentId;
      this.document = null;
      this.pages = [];
      this.selectedPage = null;
      this.loadDocument(documentId);
      this.loadPages(documentId);
    });
  }

  loadDocument(documentId: string): void {
    this.documentService.getDocument(documentId).subscribe(doc => {
      if (this.currentDocumentId !== documentId) return;
      this.document = doc;
    });
  }

  loadPages(documentId: string): void {
    this.pageService.getPagesByDocument(documentId).subscribe(pages => {
      if (this.currentDocumentId !== documentId) return;
      this.pages = pages.sort((a, b) => a.order - b.order);
      if (this.pages.length > 0) {
        this.selectPage(this.pages[0]);
      } else {
        this.selectedPage = null;
      }
    });
  }

  selectPage(page: Page): void {
    this.selectedPage = JSON.parse(JSON.stringify(page));
  }

  addPage(): void {
    if (!this.document) return;

    const newPage: Partial<Page> = {
      id: 'page' + Date.now(),
      documentId: this.document.id,
      title: 'Untitled',
      icon: '📄',
      order: this.pages.length + 1,
      parentId: null,
      content: {
        blocks: [
          {
            id: 'block' + Date.now(),
            type: 'text',
            content: '',
            order: 0
          }
        ]
      }
    };

    this.pageService.createPage(newPage).subscribe(page => {
      this.pages.push(page);
      this.pages.sort((a, b) => a.order - b.order);
      this.selectPage(page);
    });
  }

  deletePage(pageId: string): void {
    if (this.pages.length <= 1) {
      alert('Cannot delete the last page');
      return;
    }

    if (confirm('Delete this page?')) {
      this.pageService.deletePage(pageId).subscribe(() => {
        this.pages = this.pages.filter(p => p.id !== pageId);
        
        if (this.selectedPage?.id === pageId && this.pages.length > 0) {
          this.selectPage(this.pages[0]);
        }
      });
    }
  }

  duplicatePage(page: Page): void {
    this.pageService.duplicatePage(page).subscribe(newPage => {
      this.pages.push(newPage);
      this.pages.sort((a, b) => a.order - b.order);
      this.selectPage(newPage);
    });
  }

  dropPage(event: CdkDragDrop<Page[]>): void {
    moveItemInArray(this.pages, event.previousIndex, event.currentIndex);
    this.pageService.reorderPages(this.pages).subscribe();
  }

  startRename(page: Page): void {
    this.renamingPageId = page.id;
    this.renamingPageTitle = page.title;
    setTimeout(() => {
      const input = document.getElementById('rename-input');
      if (input) {
        (input as HTMLInputElement).focus();
        (input as HTMLInputElement).select();
      }
    }, 100);
  }

  saveRename(page: Page): void {
    if (this.renamingPageTitle.trim() && this.renamingPageTitle !== page.title) {
      this.pageService.updatePage(page.id, {
        title: this.renamingPageTitle.trim()
      }).subscribe(updatedPage => {
        const index = this.pages.findIndex(p => p.id === page.id);
        if (index !== -1) {
          this.pages[index] = updatedPage;
        }
        if (this.selectedPage?.id === page.id) {
          this.selectedPage = updatedPage;
        }
      });
    }
    this.renamingPageId = null;
    this.renamingPageTitle = '';
  }

  cancelRename(): void {
    this.renamingPageId = null;
    this.renamingPageTitle = '';
  }

  onRenameKeydown(event: KeyboardEvent, page: Page): void {
    if (event.key === 'Enter') {
      this.saveRename(page);
    } else if (event.key === 'Escape') {
      this.cancelRename();
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  backToDocuments(): void {
    if (this.document?.projectId) {
      this.router.navigate(['/project', this.document.projectId]);
    } else {
      this.router.navigate(['/documents']);
    }
  }
}
