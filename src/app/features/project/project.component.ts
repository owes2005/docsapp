import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DocumentService } from 'src/app/core/services/document.service';
import { Project, Folder, Document } from 'src/app/core/models/document.model';

@Component({
  selector: 'app-project',
  templateUrl: './project.component.html',
  styleUrls: ['./project.component.css'],
})
export class ProjectComponent implements OnInit {
  project: Project | null = null;
  folders: Folder[] = [];
  documents: Document[] = [];
  activeFolderId: string | null = null;

  // Inline inputs
  showNewFolderInput = false;
  newFolderName = '';
  addingDocToFolder: string | null = null;
  newDocName = '';
  renamingFolderId: string | null = null;
  renamingFolderName = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private documentService: DocumentService,
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const projectId = params['projectId'];
      this.loadProject(projectId);
      this.loadFolders(projectId);
      this.loadDocuments(projectId); // Changed to filter by project
    });

    // Scroll to specific folder if folderId in query params
    this.route.queryParams.subscribe((params) => {
      if (params['folderId']) {
        this.activeFolderId = params['folderId'];
        setTimeout(() => {
          const el = document.getElementById('folder-' + params['folderId']);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    });
  }

  loadProject(projectId: string): void {
    this.documentService.getProjects().subscribe((projects) => {
      this.project = projects.find((p) => p.id === projectId) || null;
    });
  }

  loadFolders(projectId: string): void {
    this.documentService.getFoldersByProject(projectId).subscribe((folders) => {
      this.folders = folders;
    });
  }

  loadDocuments(projectId: string): void {
    this.documentService.getDocuments().subscribe((docs) => {
      // Filter documents to only show those belonging to this project
      this.documents = docs.filter((d) => d.projectId === projectId);
    });
  }

  getDocsForFolder(folderId: string): Document[] {
    return this.documents.filter((d) => d.folderId === folderId);
  }

  getTotalDocumentsCount(): number {
    return this.documents.length;
  }

  // ===== FOLDER ACTIONS =====

  showCreateFolder(): void {
    this.showNewFolderInput = true;
    this.newFolderName = '';
    setTimeout(() => {
      const input = document.getElementById('new-folder-input');
      if (input) input.focus();
    }, 100);
  }

  createFolder(): void {
    if (this.newFolderName.trim() && this.project) {
      this.documentService
        .createFolder(this.newFolderName.trim(), this.project.id)
        .subscribe((folder) => {
          this.folders.push(folder);
        });
    }
    this.showNewFolderInput = false;
    this.newFolderName = '';
  }

  cancelCreateFolder(): void {
    this.showNewFolderInput = false;
    this.newFolderName = '';
  }

  onFolderKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.createFolder();
    if (event.key === 'Escape') this.cancelCreateFolder();
  }

  deleteFolder(folderId: string): void {
    if (confirm('Delete this folder and all its documents?')) {
      this.documentService.deleteFolder(folderId).subscribe(() => {
        this.folders = this.folders.filter((f) => f.id !== folderId);
        this.documents = this.documents.filter((d) => d.folderId !== folderId);
      });
    }
  }

  // ===== DOCUMENT ACTIONS =====

  showCreateDoc(folderId: string): void {
    this.addingDocToFolder = folderId;
    this.newDocName = '';
    setTimeout(() => {
      const input = document.getElementById('doc-input-' + folderId);
      if (input) input.focus();
    }, 100);
  }

  createDocument(folderId: string): void {
    if (this.newDocName.trim() && this.project) {
      const newDoc: Partial<Document> = {
        id: 'doc' + Date.now(),
        workspaceId: 'ws1',
        projectId: this.project.id,
        folderId: folderId,
        title: this.newDocName.trim(),
        icon: '📄',
        isFavorite: false,
        isOwned: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.documentService.createDocument(newDoc).subscribe((doc) => {
        this.documents.push(doc);
        this.router.navigate(['/document', doc.id]);
      });
    }
    this.addingDocToFolder = null;
    this.newDocName = '';
  }

  cancelCreateDoc(): void {
    this.addingDocToFolder = null;
    this.newDocName = '';
  }

  onDocKeydown(event: KeyboardEvent, folderId: string): void {
    if (event.key === 'Enter') this.createDocument(folderId);
    if (event.key === 'Escape') this.cancelCreateDoc();
  }

  openDocument(docId: string): void {
    this.router.navigate(['/document', docId]);
  }

  deleteDocument(docId: string): void {
    if (confirm('Delete this document?')) {
      this.documentService.deleteDocument(docId).subscribe(() => {
        this.documents = this.documents.filter((d) => d.id !== docId);
      });
    }
  }
}
