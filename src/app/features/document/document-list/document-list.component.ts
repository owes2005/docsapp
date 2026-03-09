import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DocumentService } from 'src/app/core/services/document.service';
import { Document, Folder, Project } from 'src/app/core/models/document.model';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-document-list',
  templateUrl: './document-list.component.html',
  styleUrls: ['./document-list.component.css']
})
export class DocumentListComponent implements OnInit {
  // Source streams from DocumentService cache.
  documents$: Observable<Document[]>;
  folders$: Observable<Folder[]>;
  projects$: Observable<Project[]>;
  filteredDocuments$: Observable<Document[]>;
  
  searchQuery = '';
  activeFilter = 'projects';
  selectedProjectId: string | null = null;
  renamingDocId: string | number | null = null;
  renamingTitle = '';
  renamingFolderId: string | number | null = null;
  renamingFolderName = '';
  showNewFolderInput = false;
  newFolderName = '';
  searchEnabled = false;

  private readonly searchableFilters = new Set(['recent', 'favorites', 'owned']);

  constructor(
    private documentService: DocumentService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.documents$ = this.documentService.documents$;
    this.folders$ = this.documentService.folders$;
    this.projects$ = this.documentService.projects$;
    this.filteredDocuments$ = this.documents$;
  }

 ngOnInit(): void {
  // Prime service caches used by list and sidebar.
  this.documentService.getDocuments().subscribe();
  this.documentService.getFolders().subscribe();
  this.documentService.getProjects().subscribe();

  // Handle filter from sidebar navigation
  this.route.queryParams.subscribe(params => {
    if (params['filter']) {
      this.setFilter(params['filter']);
    }
  });
}

  // ===== FILTER =====

  setFilter(filter: string): void {
    this.activeFilter = filter;
    this.searchEnabled = this.searchableFilters.has(this.activeFilter);
    if (filter !== 'projects') {
      this.selectedProjectId = null;
    }
    this.applyFilter();
  }

  selectProject(projectId: string | null): void {
    this.activeFilter = 'projects';
    this.searchEnabled = this.searchableFilters.has(this.activeFilter);
    this.selectedProjectId = projectId;
    this.applyFilter();
  }

  openProject(project: Project): void {
    this.selectedProjectId = project.id;
    this.router.navigate(['/project', project.id]);
  }

  applyFilter(): void {
    this.filteredDocuments$ = this.documents$.pipe(
      map(docs => {
        // Keep filtering purely derived from source stream + UI state.
        let filtered = docs;

        // Apply search
        if (this.searchEnabled && this.searchQuery.trim()) {
          filtered = filtered.filter(doc =>
            doc.title.toLowerCase().includes(this.searchQuery.toLowerCase())
          );
        }

        // Apply active tab semantics.
        switch (this.activeFilter) {
          case 'projects':
            filtered = this.selectedProjectId
              ? filtered.filter(doc => doc.projectId === this.selectedProjectId)
              : [];
            filtered = filtered.sort((a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
            break;
          case 'favorites':
            filtered = filtered.filter(doc => doc.isFavorite);
            break;
          case 'owned':
            filtered = filtered.filter(doc => doc.isOwned);
            break;
          case 'recent':
          default:
            filtered = filtered.sort((a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
            break;
        }

        return filtered;
      })
    );
  }

  onSearch(): void {
    if (!this.searchEnabled) {
      return;
    }
    this.applyFilter();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilter();
  }

  // ===== DOCUMENT ACTIONS =====

  openDocument(doc: Document): void {
    this.router.navigate(['/document', doc.id]);
  }

  duplicateDocument(event: Event, doc: Document): void {
    event.stopPropagation();
    this.documentService.duplicateDocument(doc).subscribe();
  }

  toggleFavorite(event: Event, doc: Document): void {
    event.stopPropagation();
    this.documentService.toggleFavorite(doc).subscribe();
  }

deleteDocument(event: Event, id: string): void {
  event.stopPropagation();
  if (confirm('Delete this document?')) {
    this.documentService.deleteDocument(String(id)).subscribe();
  }
}

  // ===== RENAME =====

  startRename(event: Event, doc: Document): void {
    event.stopPropagation();
    this.renamingDocId = doc.id;
    this.renamingTitle = doc.title;
    setTimeout(() => {
      const input = document.getElementById('rename-input-' + doc.id);
      if (input) {
        input.focus();
        (input as HTMLInputElement).select();
      }
    }, 100);
  }

  saveRename(doc: Document): void {
    if (this.renamingTitle.trim() && this.renamingTitle !== doc.title) {
      this.documentService.renameDocument(doc.id, this.renamingTitle.trim()).subscribe();
    }
    this.renamingDocId = null;
    this.renamingTitle = '';
  }

  cancelRename(): void {
    this.renamingDocId = null;
    this.renamingTitle = '';
  }

  onRenameKeydown(event: KeyboardEvent, doc: Document): void {
    if (event.key === 'Enter') {
      this.saveRename(doc);
    } else if (event.key === 'Escape') {
      this.cancelRename();
    }
  }

  // ===== FOLDERS =====

  showCreateFolder(): void {
    this.showNewFolderInput = true;
    this.newFolderName = '';
    setTimeout(() => {
      const input = document.getElementById('new-folder-input');
      if (input) input.focus();
    }, 100);
  }

  createFolder(): void {
  if (this.newFolderName.trim()) {
    this.documentService.createFolder(
      this.newFolderName.trim(),
      'general'
    ).subscribe();
  }
  this.showNewFolderInput = false;
  this.newFolderName = '';
}

  cancelCreateFolder(): void {
    this.showNewFolderInput = false;
    this.newFolderName = '';
  }

  onFolderKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.createFolder();
    } else if (event.key === 'Escape') {
      this.cancelCreateFolder();
    }
  }

  openFolder(folder: Folder): void {
    // Route with folder query param so project page can auto-scroll/highlight.
    this.router.navigate(['/project', folder.projectId], {
      queryParams: { folderId: folder.id }
    });
  }

  deleteFolder(event: Event, id: string): void {
  event.stopPropagation();
  if (confirm('Delete this folder?')) {
    this.documentService.deleteFolder(String(id)).subscribe({
      error: (err) => {
        alert(err?.message || 'Delete documents in this folder first.');
      }
    });
  }
}

  startFolderRename(event: Event, folder: Folder): void {
    event.stopPropagation();
    this.renamingFolderId = folder.id;
    this.renamingFolderName = folder.name;
    setTimeout(() => {
      const input = document.getElementById('folder-rename-input-' + folder.id);
      if (input) {
        input.focus();
        (input as HTMLInputElement).select();
      }
    }, 100);
  }

  saveFolderRename(folder: Folder): void {
    if (
      this.renamingFolderName.trim() &&
      this.renamingFolderName.trim() !== folder.name
    ) {
      this.documentService
        .renameFolder(String(folder.id), this.renamingFolderName.trim())
        .subscribe();
    }
    this.cancelFolderRename();
  }

  cancelFolderRename(): void {
    this.renamingFolderId = null;
    this.renamingFolderName = '';
  }

  onFolderRenameKeydown(event: KeyboardEvent, folder: Folder): void {
    if (event.key === 'Enter') {
      this.saveFolderRename(folder);
    } else if (event.key === 'Escape') {
      this.cancelFolderRename();
    }
  }

  getFolderName(folderId: string | number | null | undefined, folders: Folder[]): string {
    if (!folderId) return 'My docs';
    const folder = folders.find(f => f.id === folderId);
    return folder ? folder.name : 'My docs';
  }

  getProjectName(projectId: string | undefined, projects: Project[]): string {
    if (!projectId) return 'Unassigned';
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : 'Unassigned';
  }
}
