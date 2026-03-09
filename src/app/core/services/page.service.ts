import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { Page, ContentBlock, BlockType } from '../models/page.model';

@Injectable({
  providedIn: 'root'
})
export class PageService {
  private apiUrl = 'http://localhost:3000';
  // Shared page state for components that subscribe to page collections.
  private pagesSubject = new BehaviorSubject<Page[]>([]);
  public pages$ = this.pagesSubject.asObservable();
  // Tracks current page selection across editor/tooling components.
  private activePageIdSubject = new BehaviorSubject<string | null>(null);
  public activePageId$ = this.activePageIdSubject.asObservable();
  private idCounter = 0;

  constructor(private http: HttpClient) {}

  getPages(): Observable<Page[]> {
    return this.http.get<Page[]>(`${this.apiUrl}/pages`).pipe(
      map((pages) => pages.map((page) => this.normalizePageFromStorage(page))),
      tap((pages) => this.pagesSubject.next(pages)),
      catchError(this.handleError)
    );
  }

  getPagesByDocument(documentId: string): Observable<Page[]> {
    return this.http.get<Page[]>(
      `${this.apiUrl}/pages?documentId=${documentId}`
    ).pipe(
      map((pages) => pages.map((page) => this.normalizePageFromStorage(page))),
      tap((pages) => this.pagesSubject.next(pages)),
      catchError(this.handleError)
    );
  }

  getPage(id: string): Observable<Page> {
    return this.http.get<Page>(`${this.apiUrl}/pages/${id}`).pipe(
      map((page) => this.normalizePageFromStorage(page)),
      catchError(this.handleError)
    );
  }

  createPage(page: Partial<Page>): Observable<Page> {
    // Accept either flat editor blocks or grouped storage blocks, then normalize.
    const incomingBlocks = this.normalizeBlocksToFlat(page.content?.blocks || []);
    const blocks: ContentBlock[] = incomingBlocks.length > 0
      ? incomingBlocks.map((block, index) => ({
          ...block,
          blockId: block.blockId || `block-${Date.now()}-${index}`,
          id: block.id || this.createBlockId(block.type || 'text', incomingBlocks, index),
          order: block.order ?? index
        } as ContentBlock))
      : [
          ({
            id: this.createBlockId('text'),
            blockId: `block-${Date.now()}-0`,
            type: 'text',
            content: '',
            order: 0
          } as ContentBlock)
        ];

    const newPage = {
      ...page,
      content: {
        id: page.content?.id || 'content-' + Date.now(),
        // Persist nested/grouped structure expected by storage.
        blocks: this.serializeBlocksForStorage(blocks)
      }
    };
    
    return this.http.post<Page>(`${this.apiUrl}/pages`, newPage).pipe(
      map((createdPage) => this.normalizePageFromStorage(createdPage)),
      tap(createdPage => {
        const currentPages = this.pagesSubject.value;
        this.pagesSubject.next([...currentPages, createdPage]);
      }),
      catchError(this.handleError)
    );
  }

  updatePage(id: string, page: Partial<Page>): Observable<Page> {
    const payload: Partial<Page> = { ...page };
    if (payload.content?.blocks) {
      // Ensure payload is always written using storage schema.
      const normalized = this.normalizeBlocksToFlat(payload.content.blocks);
      payload.content = {
        ...payload.content,
        blocks: this.serializeBlocksForStorage(normalized)
      };
    }

    return this.http.patch<Page>(`${this.apiUrl}/pages/${id}`, payload).pipe(
      map((updatedPage) => this.normalizePageFromStorage(updatedPage)),
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
    const normalizedPage = this.normalizePageFromStorage(page);
    const duplicatedBlocks = (normalizedPage.content?.blocks || []).map((block, index, source) => ({
      ...block,
      id: this.createBlockId(block.type, source, index),
      blockId: `block-${Date.now()}-${index}`,
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
        blocks: this.serializeBlocksForStorage(duplicatedBlocks)
      }
    };

    return this.http.post<Page>(`${this.apiUrl}/pages`, duplicatedPage).pipe(
      map((newPage) => this.normalizePageFromStorage(newPage)),
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
    _blocks?: Array<{ id?: string; type?: string; blockId?: string }>,
    currentIndex?: number
  ): string {
    const safeType = (type || 'text').toLowerCase();
    const ts = Date.now();
    const suffix = `${++this.idCounter}-${Math.floor(Math.random() * 10000)}`;
    return currentIndex !== undefined
      ? `${safeType}-${ts}-${currentIndex}-${suffix}`
      : `${safeType}-${ts}-${suffix}`;
  }

  setActivePageId(pageId: string | null): void {
    this.activePageIdSubject.next(pageId);
  }

  getActivePageId(): string | null {
    return this.activePageIdSubject.value;
  }

  private normalizePageFromStorage(page: any): Page {
    // Convert persisted grouped content into flat editor-friendly blocks.
    const blocks = this.normalizeBlocksToFlat(page?.content?.blocks || []);
    return {
      ...page,
      content: {
        id: page?.content?.id || `content-${page?.id || Date.now()}`,
        blocks
      }
    };
  }

  private normalizeBlocksToFlat(rawBlocks: any[]): ContentBlock[] {
    if (!Array.isArray(rawBlocks) || rawBlocks.length === 0) {
      return [];
    }

    // Support both old flat payloads and new grouped payloads.
    const looksGrouped = rawBlocks.some((block) => Array.isArray(block?.items));
    if (!looksGrouped) {
      return [...rawBlocks]
        .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
        .map((block, index) => this.normalizeFlatBlock(block, index));
    }

    const flat: ContentBlock[] = [];
    const sortedGroups = [...rawBlocks].sort(
      (a, b) => (a?.order ?? 0) - (b?.order ?? 0)
    );

    for (const group of sortedGroups) {
      const groupId = typeof group?.blockId === 'string' && group.blockId
        ? group.blockId
        : `block-${Date.now()}-${flat.length}`;
      const items = Array.isArray(group?.items) ? group.items : [];
      const sortedItems = [...items].sort(
        (a, b) => (a?.order ?? 0) - (b?.order ?? 0)
      );

      for (const item of sortedItems) {
        const inferredType = this.resolveBlockType(item);
        const itemId = typeof item?.itemId === 'string' && item.itemId
          ? item.itemId
          : this.createBlockId(inferredType);
        const imagePayload = this.readImagePayload(item);

        flat.push({
          id: itemId,
          blockId: groupId,
          type: inferredType,
          content: inferredType === 'image'
            ? imagePayload
            : item?.content ?? '',
          order: flat.length,
          level: typeof item?.level === 'number' ? item.level : undefined,
          imageUrl: imagePayload.url,
          imageCaption: imagePayload.caption
        });
      }
    }

    return flat;
  }

  private normalizeFlatBlock(block: any, index: number): ContentBlock {
    const type = this.resolveBlockType(block);
    const imagePayload = this.readImagePayload(block);
    return {
      ...block,
      id: block?.id || this.createBlockId(type),
      blockId: block?.blockId || `block-${Date.now()}-${index}`,
      type,
      content: type === 'image' ? imagePayload : (block?.content ?? ''),
      order: block?.order ?? index,
      level: typeof block?.level === 'number' ? block.level : undefined,
      imageUrl: imagePayload.url,
      imageCaption: imagePayload.caption
    };
  }

  private serializeBlocksForStorage(blocks: ContentBlock[]): any[] {
    // Group by logical blockId so one visual block can hold mixed typed items.
    const grouped = new Map<string, ContentBlock[]>();

    for (const block of [...blocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
      const key = block.blockId || `block-${block.id}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(block);
    }

    const output: any[] = [];
    let groupOrder = 0;
    for (const [blockId, items] of grouped.entries()) {
      const serializedItems: any[] = [];
      const sortedItems = items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      for (const item of sortedItems) {
        const expanded = this.expandBlockToStorageItems(item);
        for (const part of expanded) {
          serializedItems.push({
            ...part,
            order: serializedItems.length
          });
        }
      }

      output.push({
        blockId,
        order: groupOrder++,
        items: serializedItems
      });
    }

    return output;
  }

  private expandBlockToStorageItems(item: ContentBlock): any[] {
    if (
      item.type !== 'text' &&
      item.type !== 'heading'
    ) {
      return [this.toStorageItem(item)];
    }

    const raw = typeof item.content === 'string' ? item.content : '';
    if (!raw || !/<img\b/i.test(raw)) {
      return [this.toStorageItem(item)];
    }

    // Split mixed HTML (text + inline image) into distinct typed storage items.
    const mixed = this.splitMixedHtmlIntoTypedItems(raw, item.type, item.level);
    if (mixed.length <= 1) {
      return [this.toStorageItem(item)];
    }

    return mixed.map((part, index) => {
      const partId = index === 0 ? item.id : this.createBlockId(part.type);
      const blockPart: ContentBlock = {
        id: partId,
        blockId: item.blockId,
        type: part.type,
        content: part.content,
        order: item.order,
        level: part.type === 'heading' ? (item.level ?? 1) : undefined,
        imageUrl: part.type === 'image' ? part.url : '',
        imageCaption: part.type === 'image' ? part.caption : ''
      };
      return this.toStorageItem(blockPart);
    });
  }

  private splitMixedHtmlIntoTypedItems(
    html: string,
    textType: BlockType,
    headingLevel?: number
  ): Array<{
    type: BlockType;
    content: any;
    url?: string;
    caption?: string;
    level?: number | null;
  }> {
    if (typeof document === 'undefined') {
      // Non-browser fallback (tests/SSR): preserve raw content.
      return [{ type: textType, content: html, level: headingLevel ?? null }];
    }

    const container = document.createElement('div');
    container.innerHTML = html;

    const out: Array<{
      type: BlockType;
      content: any;
      url?: string;
      caption?: string;
      level?: number | null;
    }> = [];
    let textBuffer = '';

    const flushText = (): void => {
      const normalized = (textBuffer || '').trim();
      if (!normalized || normalized === '<br>') {
        textBuffer = '';
        return;
      }
      out.push({
        type: textType,
        content: normalized,
        level: textType === 'heading' ? (headingLevel ?? 1) : null
      });
      textBuffer = '';
    };

    const toHtml = (node: ChildNode): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return (node.textContent || '').trim();
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        return (node as HTMLElement).outerHTML || '';
      }
      return '';
    };

    const extractImageIfImageOnly = (
      node: ChildNode
    ): { url: string; caption: string } | null => {
      if (node.nodeType !== Node.ELEMENT_NODE) return null;
      const el = node as HTMLElement;
      const imgs = Array.from(el.querySelectorAll('img'));
      if (imgs.length !== 1) return null;

      const plain = (el.textContent || '').replace(/\s+/g, '').trim();
      if (plain.length > 0) return null;

      const img = imgs[0];
      const src = img.getAttribute('src') || '';
      if (!src) return null;
      const alt = img.getAttribute('alt') || '';
      return { url: src, caption: alt };
    };

    const children = Array.from(container.childNodes);
    for (const node of children) {
      const imageOnly = extractImageIfImageOnly(node);
      if (imageOnly) {
        flushText();
        out.push({
          type: 'image',
          content: '',
          url: imageOnly.url,
          caption: imageOnly.caption,
          level: null
        });
        continue;
      }

      textBuffer += toHtml(node);
    }

    flushText();

    return out.length > 0
      ? out
      : [{ type: textType, content: html, level: headingLevel ?? null }];
  }

  private toStorageItem(item: ContentBlock): any {
    // Normalized storage record used by grouped payload format.
    const imagePayload = this.readImagePayload(item);
    const base = {
      itemId: item.id,
      type: item.type,
      content: item.type === 'image' ? '' : (item.content ?? ''),
      url: item.type === 'image' ? imagePayload.url : '',
      caption: item.type === 'image' ? imagePayload.caption : '',
      level: item.level ?? null,
      order: 0
    };

    if (item.type === 'gallery') {
      return {
        ...base,
        content: Array.isArray(item.content) ? item.content : []
      };
    }

    return base;
  }

  private readImagePayload(block: any): { url: string; caption: string } {
    // Accept image metadata from legacy and current field shapes.
    const contentObj =
      block?.content &&
      typeof block.content === 'object' &&
      !Array.isArray(block.content)
        ? block.content
        : null;
    const url = typeof block?.url === 'string' && block.url
      ? block.url
      : typeof block?.imageUrl === 'string' && block.imageUrl
        ? block.imageUrl
        : typeof contentObj?.url === 'string'
          ? contentObj.url
          : '';
    const caption = typeof block?.caption === 'string'
      ? block.caption
      : typeof block?.imageCaption === 'string'
        ? block.imageCaption
        : typeof contentObj?.caption === 'string'
          ? contentObj.caption
          : '';
    return { url, caption };
  }

  private resolveBlockType(block: any): BlockType {
    // Infer type for malformed/legacy records when "type" is absent.
    const rawType = String(block?.type || '').toLowerCase();
    if (
      rawType === 'heading' ||
      rawType === 'text' ||
      rawType === 'image' ||
      rawType === 'gallery' ||
      rawType === 'divider'
    ) {
      return rawType as BlockType;
    }

    const imagePayload = this.readImagePayload(block);
    if (imagePayload.url) return 'image';
    if (typeof block?.level === 'number') return 'heading';
    return 'text';
  }
}
