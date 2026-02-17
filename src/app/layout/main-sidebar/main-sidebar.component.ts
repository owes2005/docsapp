import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DocumentService } from 'src/app/core/services/document.service';
import { Document, Folder } from 'src/app/core/models/document.model';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-main-sidebar',
  templateUrl: './main-sidebar.component.html',
  styleUrls: ['./main-sidebar.component.css']
})
export class MainSidebarComponent implements OnInit {
  documents$: Observable<Document[]>;
  folders$: Observable<Folder[]>;
  currentWorkspace = 'My Workspace';

  constructor(
    private documentService: DocumentService,
    private router: Router
  ) {
    this.documents$ = this.documentService.documents$;
    this.folders$ = this.documentService.folders$;
  }

  ngOnInit(): void {
    this.documentService.getFolders().subscribe();
  }

  openDocument(doc: Document): void {
    this.router.navigate(['/document', doc.id]);
  }



  navigateToRecent(): void {
    this.router.navigate(['/documents'], {
      queryParams: { filter: 'recent' }
    });
  }


  createNewFolder(): void {
    const name = prompt('Enter folder name:');
    if (name && name.trim()) {
      this.documentService.createFolder(name.trim()).subscribe();
    }
  }
}
