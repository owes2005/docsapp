import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Document } from '../models/document.model';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private apiUrl = 'http://localhost:3000';
  private documentsSubject = new BehaviorSubject<Document[]>([]);
  public documents$ = this.documentsSubject.asObservable();

  constructor(private http: HttpClient) {}

  getDocuments(): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.apiUrl}/documents`).pipe(
      tap(documents => this.documentsSubject.next(documents)),
      catchError(this.handleError)
    );
  }

  getDocument(id: string): Observable<Document> {
    return this.http.get<Document>(`${this.apiUrl}/documents/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  createDocument(document: Partial<Document>): Observable<Document> {
    return this.http.post<Document>(`${this.apiUrl}/documents`, document).pipe(
      tap(() => this.getDocuments().subscribe()),
      catchError(this.handleError)
    );
  }

  updateDocument(id: string, document: Partial<Document>): Observable<Document> {
    return this.http.put<Document>(`${this.apiUrl}/documents/${id}`, document).pipe(
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

  private handleError(error: any): Observable<never> {
    console.error('Document Service Error:', error);
    return throwError(() => new Error('Something went wrong'));
  }
}