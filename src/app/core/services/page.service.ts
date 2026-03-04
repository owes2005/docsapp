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

  getPages(): Observable<Page[]> {
    return this.http.get<Page[]>(`${this.apiUrl}/pages`).pipe(
      tap(pages => this.pagesSubject.next(pages)),
      catchError(this.handleError)
    );
  }

  getPagesByDocument(documentId: string): Observable<Page[]> {
    return this.http.get<Page[]>(
      `${this.apiUrl}/pages?documentId=${documentId}`
    ).pipe(
      tap(pages => this.pagesSubject.next(pages)),
      catchError(this.handleError)
    );
  }

  getPage(id: string): Observable<Page> {
    return this.http.get<Page>(`${this.apiUrl}/pages/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  createPage(page: Partial<Page>): Observable<Page> {
    const incomingBlocks = page.content?.blocks || [];
    const blocks = incomingBlocks.length > 0
      ? incomingBlocks.map((block, index) => ({
          ...block,
          id: block.id || this.createBlockId(block.type || 'text', incomingBlocks, index),
          order: block.order ?? index
        }))
      : [
          {
            id: this.createBlockId('text'),
            type: 'text',
            content: '',
            order: 0
          }
        ];

    const newPage = {
      ...page,
      content: {
        id: page.content?.id || 'content-' + Date.now(),
        blocks
      }
    };
    
    return this.http.post<Page>(`${this.apiUrl}/pages`, newPage).pipe(
      tap(createdPage => {
        const currentPages = this.pagesSubject.value;
        this.pagesSubject.next([...currentPages, createdPage]);
      }),
      catchError(this.handleError)
    );
  }

  updatePage(id: string, page: Partial<Page>): Observable<Page> {
    return this.http.patch<Page>(`${this.apiUrl}/pages/${id}`, page).pipe(
      tap(updatedPage => {
        const currentPages = this.pagesSubject.value;
        const index = currentPages.findIndex(p => p.id === id);
        if (index !== -1) {
          currentPages[index] = updatedPage;
          this.pagesSubject.next([...currentPages]);
        }
      }),
      catchError(this.handleError)
    );
  }

  deletePage(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/pages/${id}`).pipe(
      tap(() => {
        const currentPages = this.pagesSubject.value;
        this.pagesSubject.next(currentPages.filter(p => p.id !== id));
      }),
      catchError(this.handleError)
    );
  }

  duplicatePage(page: Page): Observable<Page> {
    const duplicatedBlocks = (page.content?.blocks || []).map((block, index, source) => ({
      ...block,
      id: this.createBlockId(block.type, source, index),
      order: index
    }));

    // Deep clone the page content to avoid reference issues
    const duplicatedPage: Partial<Page> = {
      documentId: page.documentId,
      title: page.title + ' (Copy)',
      icon: page.icon,
      order: page.order + 1,
      parentId: page.parentId,
      content: {
        id: 'content-' + Date.now(),
        blocks: duplicatedBlocks
      }
    };

    return this.http.post<Page>(`${this.apiUrl}/pages`, duplicatedPage).pipe(
      tap(newPage => {
        const currentPages = this.pagesSubject.value;
        this.pagesSubject.next([...currentPages, newPage]);
      }),
      catchError(this.handleError)
    );
  }

  reorderPages(pages: Page[]): Observable<Page[]> {
    const updates = pages.map((page, index) => {
      return this.http.patch<Page>(`${this.apiUrl}/pages/${page.id}`, {
        order: index + 1
      }).toPromise();
    });

    return new Observable(observer => {
      Promise.all(updates).then(updatedPages => {
        this.pagesSubject.next(updatedPages as Page[]);
        observer.next(updatedPages as Page[]);
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

  private createBlockId(
    type: string,
    _blocks?: Array<{ id?: string; type?: string }>,
    currentIndex?: number
  ): string {
    const safeType = (type || 'text').toLowerCase();
    const ts = Date.now();
    return currentIndex !== undefined
      ? `${safeType}-${ts}-${currentIndex}`
      : `${safeType}-${ts}`;
  }
}
