import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Page } from '../models/page.model';

@Injectable({
  providedIn: 'root'
})
export class PageService {
  private apiUrl = 'http://localhost:3000';
  private pagesSubject = new BehaviorSubject<Page[]>([]);
  public pages$ = this.pagesSubject.asObservable();

  constructor(private http: HttpClient) {}

  getPages(documentId: string): Observable<Page[]> {
    return this.http.get<Page[]>(`${this.apiUrl}/pages?documentId=${documentId}`).pipe(
      tap(pages => {
        const sorted = pages.sort((a, b) => a.order - b.order);
        this.pagesSubject.next(sorted);
      }),
      catchError(this.handleError)
    );
  }

  getPage(id: string): Observable<Page> {
    return this.http.get<Page>(`${this.apiUrl}/pages/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  createPage(page: Partial<Page>): Observable<Page> {
    return this.http.post<Page>(`${this.apiUrl}/pages`, page).pipe(
      tap(() => page.documentId && this.getPages(page.documentId).subscribe()),
      catchError(this.handleError)
    );
  }

  updatePage(id: string, page: Partial<Page>): Observable<Page> {
    return this.http.put<Page>(`${this.apiUrl}/pages/${id}`, page).pipe(
      tap(() => page.documentId && this.getPages(page.documentId).subscribe()),
      catchError(this.handleError)
    );
  }

  deletePage(id: string, documentId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/pages/${id}`).pipe(
      tap(() => this.getPages(documentId).subscribe()),
      catchError(this.handleError)
    );
  }

  duplicatePage(pageId: string): Observable<Page> {
    return this.getPage(pageId).pipe(
      tap(originalPage => {
        const duplicatedPage = {
          ...originalPage,
          id: 'page' + Date.now(),
          title: originalPage.title + ' (Copy)',
          order: originalPage.order + 1
        };
        delete (duplicatedPage as any).id;
        this.createPage(duplicatedPage).subscribe();
      }),
      catchError(this.handleError)
    );
  }

  reorderPages(pages: Page[]): Observable<any> {
    const updates = pages.map((page, index) => {
      return this.http.put(`${this.apiUrl}/pages/${page.id}`, {
        ...page,
        order: index
      }).toPromise();
    });
    
    return new Observable(observer => {
      Promise.all(updates).then(() => {
        if (pages.length > 0) {
          this.getPages(pages[0].documentId).subscribe();
        }
        observer.next();
        observer.complete();
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  private handleError(error: any): Observable<never> {
    console.error('Page Service Error:', error);
    return throwError(() => new Error('Something went wrong'));
  }
}