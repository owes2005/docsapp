import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-shell',
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.css']
})
export class AppShellComponent implements OnInit {
  showMainSidebar = true;
  currentRoute = '';
  currentDocTitle = 'Untitled';
  
  constructor(private router: Router) {}

  ngOnInit(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentRoute = event.url;
    });
  }
  
  toggleMainSidebar(): void {
    this.showMainSidebar = !this.showMainSidebar;
  }

  isDocumentEditor(): boolean {
    return this.currentRoute.includes('/document/');
  }
}