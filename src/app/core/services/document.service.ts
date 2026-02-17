import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Document, Folder } from '../models/document.model';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private apiUrl = 'http://localhost:3000';
  private documentsSubject = new BehaviorSubject<Document[]>([]);
  private foldersSubject = new BehaviorSubject<Folder[]>([]);
  
  public documents$ = this.documentsSubject.asObservable();
  public folders$ = this.foldersSubject.asObservable();

  constructor(private http: HttpClient) {}

  // ===== DOCUMENTS =====

  getDocuments(): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.apiUrl}/documents`).pipe(
      tap(documents => this.documentsSubject.next(documents)),
      catchError(this.handleError)
    );
  }

  getDocument(id: string | number): Observable<Document> {
    return this.http.get<Document>(`${this.apiUrl}/documents/${this.encodeId(id)}`).pipe(
      catchError(this.handleError)
    );
  }

  createDocument(document: Partial<Document>): Observable<Document> {
    const newDoc = {
      ...document,
      isFavorite: document.isFavorite ?? false,
      isOwned: document.isOwned ?? true,
      folderId: document.folderId ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return this.http.post<Document>(`${this.apiUrl}/documents`, newDoc).pipe(
      tap(() => this.getDocuments().subscribe()),
      catchError(this.handleError)
    );
  }

  updateDocument(id: string | number, document: Partial<Document>): Observable<Document> {
    return this.http.patch<Document>(`${this.apiUrl}/documents/${this.encodeId(id)}`, document).pipe(
      tap(() => this.refreshDocuments()),
      catchError(this.handleError)
    );
  }

  deleteDocument(id: string | number): Observable<void> {
    const previousDocuments = this.documentsSubject.value;
    const targetId = String(id);

    this.documentsSubject.next(
      previousDocuments.filter(doc => String(doc.id) !== targetId)
    );

    return this.http.delete<void>(`${this.apiUrl}/documents/${this.encodeId(id)}`).pipe(
      tap(() => this.refreshDocuments()),
      catchError(error => {
        // Roll back if API delete fails.
        this.documentsSubject.next(previousDocuments);
        return this.handleError(error);
      })
    );
  }

  duplicateDocument(doc: Document): Observable<Document> {
    const duplicate: Partial<Document> = {
      workspaceId: doc.workspaceId,
      title: doc.title + ' (Copy)',
      icon: doc.icon,
      isFavorite: false,
      isOwned: true,
      folderId: doc.folderId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return this.http.post<Document>(`${this.apiUrl}/documents`, duplicate).pipe(
      tap(() => this.refreshDocuments()),
      catchError(this.handleError)
    );
  }

  toggleFavorite(doc: Document): Observable<Document> {
    return this.http.patch<Document>(`${this.apiUrl}/documents/${this.encodeId(doc.id)}`, {
      isFavorite: !doc.isFavorite
    }).pipe(
      tap(() => this.refreshDocuments()),
      catchError(this.handleError)
    );
  }

  renameDocument(id: string | number, title: string): Observable<Document> {
    return this.http.patch<Document>(`${this.apiUrl}/documents/${this.encodeId(id)}`, {
      title: title,
      updatedAt: new Date().toISOString()
    }).pipe(
      tap(() => this.refreshDocuments()),
      catchError(this.handleError)
    );
  }

  // ===== FOLDERS =====

  getFolders(): Observable<Folder[]> {
    return this.http.get<Folder[]>(`${this.apiUrl}/folders`).pipe(
      tap(folders => this.foldersSubject.next(folders)),
      catchError(this.handleError)
    );
  }

  createFolder(name: string): Observable<Folder> {
    const newFolder: Partial<Folder> = {
      workspaceId: 'ws1',
      name: name,
      createdAt: new Date().toISOString()
    };
    return this.http.post<Folder>(`${this.apiUrl}/folders`, newFolder).pipe(
      tap(() => this.refreshFolders()),
      catchError(this.handleError)
    );
  }

  deleteFolder(id: string | number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/folders/${this.encodeId(id)}`).pipe(
      tap(() => this.refreshFolders()),
      catchError(this.handleError)
    );
  }

  private encodeId(id: string | number): string {
    const value = String(id).trim();
    if (!value) {
      throw new Error('Invalid id');
    }
    return encodeURIComponent(value);
  }

  private refreshDocuments(): void {
    this.getDocuments().subscribe();
  }

  private refreshFolders(): void {
    this.getFolders().subscribe();
  }

  private handleError(error: any): Observable<never> {
    console.error('Document Service Error:', error);
    return throwError(() => new Error('Something went wrong'));
  }
}
