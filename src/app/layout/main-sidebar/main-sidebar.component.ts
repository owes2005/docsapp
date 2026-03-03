import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { DocumentService } from 'src/app/core/services/document.service';
import { Project, Folder, Document } from 'src/app/core/models/document.model';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-main-sidebar',
  templateUrl: './main-sidebar.component.html',
  styleUrls: ['./main-sidebar.component.css']
})
export class MainSidebarComponent implements OnInit {

  currentWorkspace = 'Optima Workspace';
  projects: Project[] = [];
  folders: Folder[] = [];
  documents: Document[] = [];

  expandedProjects: Set<string> = new Set();
  expandedFolders: Set<string> = new Set();

  addingFolderToProject: string | null = null;
  newFolderName = '';

  addingDocToFolder: string | null = null;
  addingDocToProject: string | null = null;
  newDocName = '';

  activeProjectId: string | null = null;
  activeFolderId: string | null = null;
  activeDocId: string | null = null;

  constructor(
    private documentService: DocumentService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.documentService.projects$.subscribe(p => {
      this.projects = p;
      this.updateActiveState(this.router.url);
    });
    this.documentService.folders$.subscribe(f => {
      this.folders = f;
      this.updateActiveState(this.router.url);
    });
    this.documentService.documents$.subscribe(d => {
      this.documents = d;
      this.updateActiveState(this.router.url);
    });

    // Initial data fetch to populate the reactive streams.
    this.documentService.getProjects().subscribe();
    this.documentService.getFolders().subscribe();
    this.documentService.getDocuments().subscribe();

    // Track active route
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.updateActiveState(e.url);
    });

    this.updateActiveState(this.router.url);
  }

  updateActiveState(url: string): void {
    const projectMatch = url.match(/\/project\/([^\/\?]+)/);
    const docMatch = url.match(/\/document\/([^\/\?]+)/);

    if (projectMatch) {
      this.activeProjectId = projectMatch[1];
      this.activeFolderId = null;
      this.activeDocId = null;
      this.expandedProjects.add(this.activeProjectId);
    } else if (docMatch) {
      this.activeDocId = docMatch[1];
      this.activeProjectId = null;
      this.activeFolderId = null;
      // Expand parent folder and project
      const doc = this.documents.find(d => d.id === docMatch[1]);
      if (doc?.folderId) {
        this.expandedFolders.add(doc.folderId);
        const folder = this.folders.find(f => f.id === doc.folderId);
        if (folder?.projectId) {
          this.expandedProjects.add(folder.projectId);
        }
      }
    }

    // Check for folder query param
    const folderMatch = url.match(/folderId=([^&]+)/);
    if (folderMatch) {
      this.activeFolderId = folderMatch[1];
      this.expandedFolders.add(this.activeFolderId);
      const folder = this.folders.find(f => f.id === folderMatch[1]);
      if (folder?.projectId) {
        this.expandedProjects.add(folder.projectId);
      }
    }
  }

  // ===== ACTIVE STATE CHECKS =====

  isProjectActive(projectId: string): boolean {
    return this.activeProjectId === projectId;
  }

  isFolderActive(folderId: string): boolean {
    return this.activeFolderId === folderId;
  }

  isDocActive(docId: string): boolean {
    return this.activeDocId === docId;
  }

  // ===== EXPAND/COLLAPSE =====

  toggleProject(projectId: string): void {
    if (this.expandedProjects.has(projectId)) {
      this.expandedProjects.delete(projectId);
    } else {
      this.expandedProjects.add(projectId);
    }
  }

  toggleFolder(folderId: string): void {
    if (this.expandedFolders.has(folderId)) {
      this.expandedFolders.delete(folderId);
    } else {
      this.expandedFolders.add(folderId);
    }
  }

  isProjectExpanded(projectId: string): boolean {
    return this.expandedProjects.has(projectId);
  }

  isFolderExpanded(folderId: string): boolean {
    return this.expandedFolders.has(folderId);
  }

  // ===== GET DATA =====

  getFoldersForProject(projectId: string): Folder[] {
    return this.folders.filter(f => f.projectId === projectId);
  }

  getDocsForFolder(folderId: string): Document[] {
    return this.documents.filter(d => d.folderId === folderId);
  }

  // ===== NAVIGATION =====

  openProject(project: Project): void {
    this.activeProjectId = project.id;
    this.activeFolderId = null;
    this.activeDocId = null;
    this.expandedProjects.add(project.id);
    this.router.navigate(['/project', project.id]);
  }

  openFolder(projectId: string, folderId: string): void {
    this.activeFolderId = folderId;
    this.activeProjectId = null;
    this.activeDocId = null;
    this.expandedFolders.add(folderId);
    this.expandedProjects.add(projectId);
    this.router.navigate(['/project', projectId], {
      queryParams: { folderId: folderId }
    });
  }

  openDocument(docId: string): void {
    this.activeDocId = docId;
    this.activeProjectId = null;
    this.activeFolderId = null;
    this.router.navigate(['/document', docId]);
  }

  createNewDocument(): void {
    this.router.navigate(['/documents']);
  }

  // ===== FOLDER ACTIONS =====

  showAddFolder(projectId: string, event: Event): void {
    event.stopPropagation();
    this.addingFolderToProject = projectId;
    this.newFolderName = '';
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

  // ===== DOC ACTIONS =====

  showAddDoc(folderId: string, projectId: string, event: Event): void {
    event.stopPropagation();
    this.addingDocToFolder = folderId;
    this.addingDocToProject = projectId;
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
        this.router.navigate(['/document', doc.id]);
      });
    }
    this.addingDocToFolder = null;
    this.addingDocToProject = null;
    this.newDocName = '';
  }

  cancelAddDoc(): void {
    this.addingDocToFolder = null;
    this.addingDocToProject = null;
    this.newDocName = '';
  }

  onDocKeydown(event: KeyboardEvent, folderId: string, projectId: string): void {
    if (event.key === 'Enter') this.createDocument(folderId, projectId);
    if (event.key === 'Escape') this.cancelAddDoc();
  }
}
