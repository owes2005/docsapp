import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { switchMap } from 'rxjs/operators';
import { Document, Folder, Project } from '../models/document.model';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private apiUrl = 'http://localhost:3000';

  // Local in-memory cache streams consumed by components.
  private documentsSubject = new BehaviorSubject<Document[]>([]);
  private foldersSubject = new BehaviorSubject<Folder[]>([]);
  private projectsSubject = new BehaviorSubject<Project[]>([]);

  public documents$ = this.documentsSubject.asObservable();
  public folders$ = this.foldersSubject.asObservable();
  public projects$ = this.projectsSubject.asObservable();

  constructor(private http: HttpClient) {}

  // ===== PROJECTS (READ ONLY - NO DELETE) =====

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.apiUrl}/projects`).pipe(
      // Keep cache and API response aligned for reactive subscribers.
      tap(projects => this.projectsSubject.next(projects)),
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

  getFoldersByProject(projectId: string): Observable<Folder[]> {
    return this.http.get<Folder[]>(
      `${this.apiUrl}/folders?projectId=${projectId}`
    ).pipe(catchError(this.handleError));
  }

  createFolder(name: string, projectId: string): Observable<Folder> {
    // Build client-side defaults expected by current JSON-server payload.
    const newFolder: Partial<Folder> = {
      id: 'folder' + Date.now(),
      projectId: projectId,
      workspaceId: 'ws1',
      name: name,
      createdAt: new Date().toISOString()
    };
    return this.http.post<Folder>(`${this.apiUrl}/folders`, newFolder).pipe(
      tap(() => this.getFolders().subscribe()),
      catchError(this.handleError)
    );
  }

  deleteFolder(id: string): Observable<void> {
    return this.http
      .get<Document[]>(`${this.apiUrl}/documents?folderId=${id}`)
      .pipe(
        // Guard against orphaned documents before folder deletion.
        switchMap((docs) => {
          if (docs.length > 0) {
            return throwError(
              () =>
                new Error(
                  'Cannot delete folder. Delete documents in this folder first.'
                )
            );
          }

          return this.http.delete<void>(`${this.apiUrl}/folders/${id}`);
        }),
      tap(() => {
        this.getFolders().subscribe();
      }),
      catchError(this.handleError)
    );
  }

  renameFolder(id: string, name: string): Observable<Folder> {
    return this.http.patch<Folder>(`${this.apiUrl}/folders/${id}`, {
      name: name
    }).pipe(
      tap(() => this.getFolders().subscribe()),
      catchError(this.handleError)
    );
  }

  // ===== DOCUMENTS =====

  getDocuments(): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.apiUrl}/documents`).pipe(
      tap(documents => this.documentsSubject.next(documents)),
      catchError(this.handleError)
    );
  }

  getDocumentsByFolder(folderId: string): Observable<Document[]> {
    return this.http.get<Document[]>(
      `${this.apiUrl}/documents?folderId=${folderId}`
    ).pipe(catchError(this.handleError));
  }

  getDocument(id: string): Observable<Document> {
    return this.http.get<Document>(`${this.apiUrl}/documents/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  createDocument(document: Partial<Document>): Observable<Document> {
    // Apply defaults so new records are render-safe in all list views.
    const newDoc = {
      ...document,
      isFavorite: false,
      isOwned: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return this.http.post<Document>(`${this.apiUrl}/documents`, newDoc).pipe(
      tap(() => this.getDocuments().subscribe()),
      catchError(this.handleError)
    );
  }

  updateDocument(id: string, document: Partial<Document>): Observable<Document> {
    return this.http.patch<Document>(
      `${this.apiUrl}/documents/${id}`, document
    ).pipe(
      tap(() => this.getDocuments().subscribe()),
      catchError(this.handleError)
    );
  }

  deleteDocument(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/documents/${id}`).pipe(
      tap(() => this.getDocuments().subscribe()),
      catchError(this.handleError)
    );
  }

  renameDocument(id: string, title: string): Observable<Document> {
    return this.http.patch<Document>(`${this.apiUrl}/documents/${id}`, {
      title: title,
      updatedAt: new Date().toISOString()
    }).pipe(
      tap(() => this.getDocuments().subscribe()),
      catchError(this.handleError)
    );
  }

  duplicateDocument(doc: Document): Observable<Document> {
    const duplicate: Partial<Document> = {
      workspaceId: doc.workspaceId,
      projectId: doc.projectId,
      folderId: doc.folderId,
      title: doc.title + ' (Copy)',
      icon: doc.icon,
      isFavorite: false,
      isOwned: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return this.http.post<Document>(`${this.apiUrl}/documents`, duplicate).pipe(
      tap(() => this.getDocuments().subscribe()),
      catchError(this.handleError)
    );
  }

  toggleFavorite(doc: Document): Observable<Document> {
    return this.http.patch<Document>(`${this.apiUrl}/documents/${doc.id}`, {
      isFavorite: !doc.isFavorite
    }).pipe(
      tap(() => this.getDocuments().subscribe()),
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('Service Error:', error);
    if (error instanceof Error && error.message) {
      return throwError(() => error);
    }

    // Normalize varying backend error shapes into one user-facing message.
    const serverMessage =
      (typeof error?.error === 'string' && error.error) ||
      error?.error?.message ||
      error?.message;

    return throwError(() => new Error(serverMessage || 'Something went wrong'));
  }
}
