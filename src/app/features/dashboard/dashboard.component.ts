import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DocumentService } from 'src/app/core/services/document.service';
import { Project, Folder, Document } from 'src/app/core/models/document.model';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  projects: Project[] = [];
  folders: Folder[] = [];
  documents: Document[] = [];

  // Track which projects are expanded
  expandedProjects: Set<string> = new Set();

  // Track which folders are expanded
  expandedFolders: Set<string> = new Set();

  // Track inline inputs
  addingFolderToProject: string | null = null;
  newFolderName = '';

  addingDocToFolder: string | null = null;
  newDocName = '';

  constructor(
    private documentService: DocumentService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.documentService.getProjects().subscribe(p => this.projects = p);
    this.documentService.getFolders().subscribe(f => this.folders = f);
    this.documentService.getDocuments().subscribe(d => this.documents = d);
  }

  // ===== PROJECT =====

  toggleProject(projectId: string): void {
    if (this.expandedProjects.has(projectId)) {
      this.expandedProjects.delete(projectId);
    } else {
      this.expandedProjects.add(projectId);
    }
  }

  isProjectExpanded(projectId: string): boolean {
    return this.expandedProjects.has(projectId);
  }

  getFoldersForProject(projectId: string): Folder[] {
    return this.folders.filter(f => f.projectId === projectId);
  }

  // ===== FOLDER =====

  toggleFolder(folderId: string): void {
    if (this.expandedFolders.has(folderId)) {
      this.expandedFolders.delete(folderId);
    } else {
      this.expandedFolders.add(folderId);
    }
  }

  isFolderExpanded(folderId: string): boolean {
    return this.expandedFolders.has(folderId);
  }

  getDocsForFolder(folderId: string): Document[] {
    return this.documents.filter(d => d.folderId === folderId);
  }

  showAddFolder(projectId: string, event: Event): void {
    event.stopPropagation();
    this.addingFolderToProject = projectId;
    this.newFolderName = '';
    // Make sure project is expanded
    this.expandedProjects.add(projectId);
    setTimeout(() => {
      const input = document.getElementById('folder-input-' + projectId);
      if (input) input.focus();
    }, 100);
  }

  createFolder(projectId: string): void {
    if (this.newFolderName.trim()) {
      this.documentService.createFolder(
        this.newFolderName.trim(),
        projectId
      ).subscribe(folder => {
        this.folders.push(folder);
        this.expandedFolders.add(folder.id);
      });
    }
    this.addingFolderToProject = null;
    this.newFolderName = '';
  }

  cancelAddFolder(): void {
    this.addingFolderToProject = null;
    this.newFolderName = '';
  }

  onFolderKeydown(event: KeyboardEvent, projectId: string): void {
    if (event.key === 'Enter') this.createFolder(projectId);
    if (event.key === 'Escape') this.cancelAddFolder();
  }

  deleteFolder(folderId: string, event: Event): void {
    event.stopPropagation();
    if (confirm('Delete this folder and all its documents?')) {
      this.documentService.deleteFolder(folderId).subscribe(() => {
        this.folders = this.folders.filter(f => f.id !== folderId);
        this.documents = this.documents.filter(d => d.folderId !== folderId);
      });
    }
  }

  // ===== DOCUMENT =====

  showAddDoc(folderId: string, event: Event): void {
    event.stopPropagation();
    this.addingDocToFolder = folderId;
    this.newDocName = '';
    this.expandedFolders.add(folderId);
    setTimeout(() => {
      const input = document.getElementById('doc-input-' + folderId);
      if (input) input.focus();
    }, 100);
  }

  createDocument(folderId: string, projectId: string): void {
    if (this.newDocName.trim()) {
      const newDoc: Partial<Document> = {
        id: 'doc' + Date.now(),
        workspaceId: 'ws1',
        projectId: projectId,
        folderId: folderId,
        title: this.newDocName.trim(),
        icon: '📄',
        isFavorite: false,
        isOwned: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.documentService.createDocument(newDoc).subscribe(doc => {
        this.documents.push(doc);
        this.router.navigate(['/document', doc.id]);
      });
    }
    this.addingDocToFolder = null;
    this.newDocName = '';
  }

  cancelAddDoc(): void {
    this.addingDocToFolder = null;
    this.newDocName = '';
  }

  onDocKeydown(event: KeyboardEvent, folderId: string, projectId: string): void {
    if (event.key === 'Enter') this.createDocument(folderId, projectId);
    if (event.key === 'Escape') this.cancelAddDoc();
  }

  openDocument(docId: string): void {
    this.router.navigate(['/document', docId]);
  }

  deleteDocument(docId: string, event: Event): void {
    event.stopPropagation();
    if (confirm('Delete this document?')) {
      this.documentService.deleteDocument(docId).subscribe(() => {
        this.documents = this.documents.filter(d => d.id !== docId);
      });
    }
  }
}