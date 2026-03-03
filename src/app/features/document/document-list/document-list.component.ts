import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DocumentService } from 'src/app/core/services/document.service';
import { Document, Folder } from 'src/app/core/models/document.model';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-document-list',
  templateUrl: './document-list.component.html',
  styleUrls: ['./document-list.component.css']
})
export class DocumentListComponent implements OnInit {
  documents$: Observable<Document[]>;
  folders$: Observable<Folder[]>;
  filteredDocuments$: Observable<Document[]>;
  
  searchQuery = '';
  activeFilter = 'recent';
  renamingDocId: string | number | null = null;
  renamingTitle = '';
  renamingFolderId: string | number | null = null;
  renamingFolderName = '';
  showNewFolderInput = false;
  newFolderName = '';

  constructor(
    private documentService: DocumentService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.documents$ = this.documentService.documents$;
    this.folders$ = this.documentService.folders$;
    this.filteredDocuments$ = this.documents$;
  }

 ngOnInit(): void {
  this.documentService.getDocuments().subscribe();
  this.documentService.getFolders().subscribe();

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
    this.applyFilter();
  }

  applyFilter(): void {
    this.filteredDocuments$ = this.documents$.pipe(
      map(docs => {
        let filtered = docs;

        // Apply search
        if (this.searchQuery.trim()) {
          filtered = filtered.filter(doc =>
            doc.title.toLowerCase().includes(this.searchQuery.toLowerCase())
          );
        }

        // Apply tab filter
        switch (this.activeFilter) {
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
    this.applyFilter();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilter();
  }
  

  // ===== DOCUMENT ACTIONS =====

  createDocument(): void {
    const newDoc = {
      workspaceId: 'ws1',
      title: 'Untitled',
      icon: '📄',
      isFavorite: false,
      isOwned: true,
      folderId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.documentService.createDocument(newDoc).subscribe(doc => {
      this.router.navigate(['/document', doc.id]);
    });
  }

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
    // Navigate to the project page with the folder highlighted
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
}
