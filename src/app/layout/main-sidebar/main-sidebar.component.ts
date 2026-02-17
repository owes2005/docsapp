import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DocumentService } from 'src/app/core/services/document.service';
import { Document } from 'src/app/core/models/document.model';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-main-sidebar',
  templateUrl: './main-sidebar.component.html',
  styleUrls: ['./main-sidebar.component.css']
})
export class MainSidebarComponent implements OnInit {
  documents$: Observable<Document[]>;
  currentWorkspace = 'My Workspace';

  constructor(
    private documentService: DocumentService,
    private router: Router
  ) {
    this.documents$ = this.documentService.documents$;
  }

  ngOnInit(): void {
    this.documentService.getDocuments().subscribe();
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  openDocument(doc: Document): void {
    this.router.navigate(['/document', doc.id]);
  }

  createNewDocument(): void {
    const newDoc = {
      id: 'doc' + Date.now(),
      workspaceId: 'ws1',
      title: 'Untitled',
      icon: '📄',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.documentService.createDocument(newDoc).subscribe(doc => {
      this.router.navigate(['/document', doc.id]);
    });
  }
}