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
  currentWorkspace = 'My Workspace';

  constructor(
    private documentService: DocumentService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.documentService.getDocuments().subscribe();
  }

  createNewDocument(): void {
    this.router.navigate(['/documents']);
  }
}