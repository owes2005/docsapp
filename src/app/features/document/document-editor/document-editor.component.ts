import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DocumentService } from 'src/app/core/services/document.service';
import { PageService } from 'src/app/core/services/page.service';
import { Document } from 'src/app/core/models/document.model';
import { Page } from 'src/app/core/models/page.model';
import { HttpClient } from '@angular/common/http';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-document-editor',
  templateUrl: './document-editor.component.html',
  styleUrls: ['./document-editor.component.css']
})
export class DocumentEditorComponent implements OnInit {
  documentId: string = '';
  document: Document | null = null;
  pages: Page[] = [];
  selectedPage: Page | null = null;

  constructor(
    private route: ActivatedRoute,
    private documentService: DocumentService,
    private pageService: PageService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.documentId = params['documentId'];
      this.loadDocument();
      this.loadPages();
    });
  }

  loadDocument(): void {
    this.documentService.getDocument(this.documentId).subscribe(doc => {
      this.document = doc;
    });
  }

  loadPages(): void {
    this.pageService.getPages(this.documentId).subscribe(pages => {
      this.pages = pages;
      if (pages.length > 0 && !this.selectedPage) {
        this.selectedPage = pages[0];
      }
    });
  }

  selectPage(page: Page): void {
    this.selectedPage = page;
  }

  addNewPage(): void {
    const newPage: Partial<Page> = {
      id: 'page' + Date.now(),
      documentId: this.documentId,
      title: 'Untitled page',
      icon: '📄',
      order: this.pages.length,
      parentId: null,
      content: {
        blocks: [
          {
            id: 'block' + Date.now(),
            type: 'heading',
            level: 1,
            content: '',
            order: 0
          }
        ]
      }
    };

    this.pageService.createPage(newPage).subscribe(page => {
      this.selectedPage = page;
    });
  }

  duplicatePage(page: Page, event: Event): void {
    event.stopPropagation();
    if (confirm(`Duplicate "${page.title}"?`)) {
      this.pageService.duplicatePage(page.id).subscribe();
    }
  }

  deletePage(page: Page, event: Event): void {
    event.stopPropagation();
    
    if (this.pages.length === 1) {
      alert('Cannot delete the last page');
      return;
    }

    if (confirm(`Delete "${page.title}"?`)) {
      this.pageService.deletePage(page.id, this.documentId).subscribe(() => {
        if (this.selectedPage?.id === page.id) {
          this.selectedPage = this.pages[0];
        }
      });
    }
  }

  renamePage(page: Page, event: Event): void {
    event.stopPropagation();
    const newTitle = prompt('Enter new page title:', page.title);
    if (newTitle && newTitle !== page.title) {
      this.pageService.updatePage(page.id, { title: newTitle }).subscribe();
    }
  }

  dropPage(event: CdkDragDrop<Page[]>): void {
    moveItemInArray(this.pages, event.previousIndex, event.currentIndex);
    this.pageService.reorderPages(this.pages).subscribe();
  }
}