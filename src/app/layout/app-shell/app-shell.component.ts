import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs/operators';
import { DocumentService } from 'src/app/core/services/document.service';

@Component({
  selector: 'app-shell',
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.css']
})
export class AppShellComponent implements OnInit {
  showMainSidebar = true;
  currentRoute = '';
  currentDocTitle = 'Untitled';
  
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private documentService: DocumentService
  ) {}

  ngOnInit(): void {
    this.currentRoute = this.router.url;
    this.updateFromRoute();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentRoute = event.url;
      this.updateFromRoute();
    });
  }
  
  toggleMainSidebar(): void {
    this.showMainSidebar = !this.showMainSidebar;
  }

  isDocumentEditor(): boolean {
    return this.currentRoute.includes('/document/');
  }

  private updateFromRoute(): void {
    let activeRoute = this.route;
    while (activeRoute.firstChild) {
      activeRoute = activeRoute.firstChild;
    }

    const docId = activeRoute.snapshot.paramMap.get('documentId');
    if (!docId) {
      this.currentDocTitle = 'Untitled';
      return;
    }

    this.documentService.getDocument(docId).subscribe({
      next: doc => {
        this.currentDocTitle = doc?.title || 'Untitled';
      },
      error: () => {
        this.currentDocTitle = 'Untitled';
      }
    });
  }
}
