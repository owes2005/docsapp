import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DocumentService } from 'src/app/core/services/document.service';
import { PageService } from 'src/app/core/services/page.service';
import { Project, Folder, Document } from 'src/app/core/models/document.model';
import { Page } from 'src/app/core/models/page.model';
import { firstValueFrom, forkJoin } from 'rxjs';
import { jsPDF } from 'jspdf';

interface ProjectPdfTheme {
  brand: number[];
  text: number[];
  muted: number[];
  border: number[];
  codeBg: number[];
}

interface ProjectPdfTextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color?: number[];
  backgroundColor?: number[];
}

@Component({
  selector: 'app-project',
  templateUrl: './project.component.html',
  styleUrls: ['./project.component.css'],
})
export class ProjectComponent implements OnInit {
  project: Project | null = null;
  folders: Folder[] = [];
  documents: Document[] = [];
  activeFolderId: string | null = null;

  // Inline inputs
  showNewFolderInput = false;
  newFolderName = '';
  addingDocToFolder: string | null = null;
  newDocName = '';
  renamingFolderId: string | null = null;
  renamingFolderName = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private documentService: DocumentService,
    private pageService: PageService,
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const projectId = params['projectId'];
      this.loadProject(projectId);
      this.loadFolders(projectId);
      this.loadDocuments(projectId); // Changed to filter by project
    });

    // Scroll to specific folder if folderId in query params
    this.route.queryParams.subscribe((params) => {
      if (params['folderId']) {
        this.activeFolderId = params['folderId'];
        setTimeout(() => {
          const el = document.getElementById('folder-' + params['folderId']);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    });
  }

  loadProject(projectId: string): void {
    this.documentService.getProjects().subscribe((projects) => {
      this.project = projects.find((p) => p.id === projectId) || null;
    });
  }

  loadFolders(projectId: string): void {
    this.documentService.getFoldersByProject(projectId).subscribe((folders) => {
      this.folders = folders;
    });
  }

  loadDocuments(projectId: string): void {
    this.documentService.getDocuments().subscribe((docs) => {
      // Filter documents to only show those belonging to this project
      this.documents = docs.filter((d) => d.projectId === projectId);
    });
  }

  getDocsForFolder(folderId: string): Document[] {
    return this.documents.filter((d) => d.folderId === folderId);
  }

  getTotalDocumentsCount(): number {
    return this.documents.length;
  }

  // ===== FOLDER ACTIONS =====

  showCreateFolder(): void {
    this.showNewFolderInput = true;
    this.newFolderName = '';
    setTimeout(() => {
      const input = document.getElementById('new-folder-input');
      if (input) input.focus();
    }, 100);
  }

  createFolder(): void {
    if (this.newFolderName.trim() && this.project) {
      this.documentService
        .createFolder(this.newFolderName.trim(), this.project.id)
        .subscribe((folder) => {
          this.folders.push(folder);
        });
    }
    this.showNewFolderInput = false;
    this.newFolderName = '';
  }

  cancelCreateFolder(): void {
    this.showNewFolderInput = false;
    this.newFolderName = '';
  }

  onFolderKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.createFolder();
    if (event.key === 'Escape') this.cancelCreateFolder();
  }

  deleteFolder(folderId: string): void {
    if (confirm('Delete this folder and all its documents?')) {
      this.documentService.deleteFolder(folderId).subscribe(() => {
        this.folders = this.folders.filter((f) => f.id !== folderId);
        this.documents = this.documents.filter((d) => d.folderId !== folderId);
      });
    }
  }

  // ===== DOCUMENT ACTIONS =====

  showCreateDoc(folderId: string): void {
    this.addingDocToFolder = folderId;
    this.newDocName = '';
    setTimeout(() => {
      const input = document.getElementById('doc-input-' + folderId);
      if (input) input.focus();
    }, 100);
  }

  createDocument(folderId: string): void {
    if (this.newDocName.trim() && this.project) {
      const newDoc: Partial<Document> = {
        id: 'doc' + Date.now(),
        workspaceId: 'ws1',
        projectId: this.project.id,
        folderId: folderId,
        title: this.newDocName.trim(),
        icon: '📄',
        isFavorite: false,
        isOwned: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.documentService.createDocument(newDoc).subscribe((doc) => {
        this.documents.push(doc);
        this.router.navigate(['/document', doc.id]);
      });
    }
    this.addingDocToFolder = null;
    this.newDocName = '';
  }

  cancelCreateDoc(): void {
    this.addingDocToFolder = null;
    this.newDocName = '';
  }

  onDocKeydown(event: KeyboardEvent, folderId: string): void {
    if (event.key === 'Enter') this.createDocument(folderId);
    if (event.key === 'Escape') this.cancelCreateDoc();
  }

  openDocument(docId: string): void {
    this.router.navigate(['/document', docId]);
  }

  deleteDocument(docId: string): void {
    if (confirm('Delete this document?')) {
      this.documentService.deleteDocument(docId).subscribe(() => {
        this.documents = this.documents.filter((d) => d.id !== docId);
      });
    }
  }

  async exportProjectData(): Promise<void> {
    if (!this.project) {
      alert('No active project found to export.');
      return;
    }

    try {
      const projectId = this.project.id;
      const [folders, allDocuments] = await Promise.all([
        firstValueFrom(this.documentService.getFoldersByProject(projectId)),
        firstValueFrom(this.documentService.getDocuments()),
      ]);

      const documents = allDocuments.filter((d) => d.projectId === projectId);
      const pageRequests = documents.map((doc) =>
        this.pageService.getPagesByDocument(doc.id)
      );
      const pagesByDocument = pageRequests.length
        ? await firstValueFrom(forkJoin(pageRequests))
        : [];

      const documentsWithPages = documents.map((doc, index) => {
        const pages = (pagesByDocument[index] || []).sort(
          (a: Page, b: Page) => a.order - b.order
        );
        return {
          ...doc,
          pages,
        };
      });

      await this.exportProjectPdf(
        this.project,
        folders.sort((a, b) => a.name.localeCompare(b.name)),
        documentsWithPages
      );
    } catch (error) {
      console.error('Project export failed:', error);
      alert('Failed to export project. Please try again.');
    }
  }

  private getSafeFilename(input: string): string {
    return input
      .trim()
      .replace(/[<>:"/\\|?*]+/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 100) || 'project';
  }

  private async exportProjectPdf(
    project: Project,
    folders: Folder[],
    documentsWithPages: Array<Document & { pages: Page[] }>
  ): Promise<void> {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const theme: ProjectPdfTheme = {
      brand: [24, 56, 97],
      text: [24, 28, 33],
      muted: [102, 114, 128],
      border: [226, 232, 240],
      codeBg: [246, 248, 252]
    };

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginLeft = 50;
    const marginRight = 50;
    const marginTop = 62;
    const marginBottom = 54;
    const footerHeight = 20;
    const blockGap = 16;
    const contentWidth = pageWidth - marginLeft - marginRight;
    let y = marginTop + 26;

    const setText = (color: number[]): void => {
      pdf.setTextColor(color[0], color[1], color[2]);
    };
    const setStroke = (color: number[]): void => {
      pdf.setDrawColor(color[0], color[1], color[2]);
    };
    const setFill = (color: number[]): void => {
      pdf.setFillColor(color[0], color[1], color[2]);
    };

    const exportDate = new Date().toLocaleString();

    const drawHeader = (): void => {
      setText(theme.brand);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('DocsApp Export', marginLeft, 34);

      setText(theme.muted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(exportDate, pageWidth - marginRight, 34, { align: 'right' });

      setStroke(theme.border);
      pdf.setLineWidth(0.8);
      pdf.line(marginLeft, marginTop - 10, pageWidth - marginRight, marginTop - 10);
      y = marginTop + 26;
    };

    const newPage = (): void => {
      pdf.addPage();
      drawHeader();
    };

    const ensureSpace = (heightNeeded: number): void => {
      const maxY = pageHeight - marginBottom - footerHeight;
      if (y + heightNeeded > maxY) {
        newPage();
      }
    };

    const writeWrapped = (
      text: string,
      size: number,
      style: 'normal' | 'bold' | 'italic' = 'normal',
      lineHeight = 16,
      color: number[] = theme.text,
      indent = 0
    ): void => {
      const clean = this.sanitizePdfText(text || '').trim();
      if (!clean) return;

      const startX = marginLeft + indent;
      const width = contentWidth - indent;
      pdf.setFont('helvetica', style);
      pdf.setFontSize(size);
      setText(color);

      const rawLines = pdf.splitTextToSize(clean, width) as string[];
      const lines = this.wrapLongWords(pdf, rawLines, width);

      for (const line of lines) {
        ensureSpace(lineHeight);
        pdf.text(line, startX, y);
        y += lineHeight;
      }
    };

    const divider = (gapBefore = 8, gapAfter = 20): void => {
      y += gapBefore;
      ensureSpace(6 + gapAfter);
      setStroke(theme.border);
      pdf.setLineWidth(0.8);
      pdf.line(marginLeft, y, pageWidth - marginRight, y);
      y += gapAfter;
    };

    const renderCodeBlock = (code: string): void => {
      const content = this.sanitizePdfText(code || '');
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(10);

      const innerPadding = 10;
      const lineHeight = 13;
      const innerWidth = contentWidth - innerPadding * 2;
      const lines = this.wrapLongWords(pdf, pdf.splitTextToSize(content, innerWidth) as string[], innerWidth);
      const blockHeight = lines.length * lineHeight + innerPadding * 2;

      y += 4;
      ensureSpace(blockHeight + 12);

      setFill(theme.codeBg);
      setStroke(theme.border);
      pdf.roundedRect(marginLeft, y, contentWidth, blockHeight, 4, 4, 'FD');

      setText(theme.text);
      let lineY = y + innerPadding + 8;
      for (const line of lines) {
        pdf.text(line || ' ', marginLeft + innerPadding, lineY);
        lineY += lineHeight;
      }

      y += blockHeight + 10;
    };

    const renderRichText = (
      html: string,
      options: {
        size: number;
        indent: number;
        lineHeight: number;
        baseStyle?: 'normal' | 'bold' | 'italic';
        color?: number[];
      }
    ): void => {
      const runs = this.extractStyledRunsFromHtml(
        html,
        options.baseStyle || 'normal',
        options.color || theme.text
      );

      if (runs.length === 0) {
        writeWrapped(this.sanitizePdfText(this.htmlToPlainText(html)), options.size, options.baseStyle || 'normal', options.lineHeight, options.color || theme.text, options.indent);
        return;
      }

      const left = marginLeft + options.indent;
      const width = contentWidth - options.indent;
      const right = left + width;
      let x = left;
      let drewAny = false;

      const newLine = (): void => {
        y += options.lineHeight;
        ensureSpace(options.lineHeight);
        x = left;
      };

      const drawSegment = (segment: string, run: ProjectPdfTextRun): void => {
        const isWhitespace = /^\s+$/.test(segment);
        const fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' =
          run.bold && run.italic ? 'bolditalic' :
          run.bold ? 'bold' :
          run.italic ? 'italic' :
          'normal';

        pdf.setFont('helvetica', fontStyle);
        pdf.setFontSize(options.size);
        const textWidth = pdf.getTextWidth(segment);

        if (!isWhitespace && run.backgroundColor) {
          setFill(run.backgroundColor);
          pdf.rect(x, y - options.lineHeight + 4, textWidth, options.lineHeight, 'F');
        }

        setText(run.color || options.color || theme.text);
        pdf.text(segment, x, y);

        if (!isWhitespace && run.underline) {
          setStroke(run.color || options.color || theme.text);
          pdf.setLineWidth(0.6);
          pdf.line(x, y + 1, x + textWidth, y + 1);
        }

        x += textWidth;
        drewAny = true;
      };

      ensureSpace(options.lineHeight + 6);

      for (const run of runs) {
        const normalizedText = this.sanitizePdfText(run.text, true);
        const runLines = normalizedText.split('\n');
        for (let lineIndex = 0; lineIndex < runLines.length; lineIndex++) {
          const line = runLines[lineIndex];
          const parts = line.split(/(\s+)/).filter((part) => part.length > 0);

          for (const part of parts) {
            const isWhitespace = /^\s+$/.test(part);
            if (isWhitespace && x === left) {
              continue;
            }

            const styleForMeasure: 'normal' | 'bold' | 'italic' | 'bolditalic' =
              run.bold && run.italic ? 'bolditalic' :
              run.bold ? 'bold' :
              run.italic ? 'italic' :
              'normal';
            pdf.setFont('helvetica', styleForMeasure);
            pdf.setFontSize(options.size);

            if (isWhitespace) {
              const widthWhitespace = pdf.getTextWidth(part);
              if (x + widthWhitespace > right) {
                newLine();
              } else {
                drawSegment(part, run);
              }
              continue;
            }

            let remaining = part;
            while (remaining.length > 0) {
              const available = right - x;
              const remainingWidth = pdf.getTextWidth(remaining);

              if (remainingWidth <= available) {
                drawSegment(remaining, run);
                remaining = '';
                break;
              }

              if (x > left) {
                newLine();
                continue;
              }

              const chunks = pdf.splitTextToSize(remaining, width) as string[];
              const chunk = chunks[0] ? String(chunks[0]) : remaining.charAt(0);
              drawSegment(chunk, run);
              remaining = remaining.slice(chunk.length);

              if (remaining.length > 0) {
                newLine();
              }
            }
          }

          if (lineIndex < runLines.length - 1) {
            newLine();
          }
        }
      }

      if (drewAny) {
        y += options.lineHeight + 6;
      }
      setText(theme.text);
    };

    const renderImage = async (imageUrl: string, caption?: string, indent = 36): Promise<void> => {
      const imageData = await this.loadImageForPdf(imageUrl);
      if (!imageData) {
        writeWrapped('[Image could not be embedded]', 10, 'italic', 14, theme.muted, indent);
        return;
      }

      const maxWidth = contentWidth - indent;
      const maxHeight = 250;
      const widthRatio = maxWidth / imageData.width;
      const heightRatio = maxHeight / imageData.height;
      const scale = Math.min(widthRatio, heightRatio, 1);
      const drawWidth = imageData.width * scale;
      const drawHeight = imageData.height * scale;
      const x = marginLeft + indent + (maxWidth - drawWidth) / 2;

      ensureSpace(drawHeight + 26);
      setStroke(theme.border);
      pdf.setLineWidth(0.6);
      pdf.addImage(imageData.dataUrl, imageData.format, x, y, drawWidth, drawHeight);
      pdf.rect(x, y, drawWidth, drawHeight);
      y += drawHeight + 8;

      if (caption) {
        writeWrapped(caption, 10, 'italic', 14, theme.muted, indent);
      }
    };

    const docsByFolder = new Map<string, Array<Document & { pages: Page[] }>>();
    for (const doc of documentsWithPages) {
      const key = doc.folderId || '__unfiled__';
      if (!docsByFolder.has(key)) docsByFolder.set(key, []);
      docsByFolder.get(key)!.push(doc);
    }

    const totalPages = documentsWithPages.reduce((sum, doc) => sum + doc.pages.length, 0);
    drawHeader();
    const safeProjectTitle = this.sanitizePdfText(project.name || '') || 'Project Export';
    writeWrapped(safeProjectTitle, 24, 'bold', 30, theme.brand, 0);
    writeWrapped(
      `Folders ${folders.length} | Documents ${documentsWithPages.length} | Pages ${totalPages}`,
      11,
      'normal',
      16,
      theme.muted,
      0
    );
    writeWrapped(`Exported ${exportDate}`, 10, 'normal', 14, theme.muted, 0);
    divider(10, 24);

    for (const folder of folders) {
      writeWrapped(`Folder: ${folder.name}`, 16, 'bold', 22, theme.brand, 0);

      const folderDocs = (docsByFolder.get(folder.id) || []).sort((a, b) =>
        a.title.localeCompare(b.title)
      );

      if (folderDocs.length === 0) {
        writeWrapped('(No documents)', 11, 'italic', 16, theme.muted, 12);
        y += 4;
        continue;
      }

      for (const doc of folderDocs) {
        writeWrapped(`Document: ${doc.title}`, 13, 'bold', 18, theme.text, 12);
        writeWrapped(`Updated ${new Date(doc.updatedAt).toLocaleString()}`, 10, 'normal', 14, theme.muted, 12);

        if (!doc.pages || doc.pages.length === 0) {
          writeWrapped('(No pages)', 11, 'italic', 15, theme.muted, 24);
          y += 3;
          continue;
        }

        for (const page of doc.pages.sort((a, b) => a.order - b.order)) {
          writeWrapped(`Page: ${page.title || 'Untitled page'}`, 11, 'bold', 16, theme.text, 24);

          const blocks = [...(page.content?.blocks || [])].sort((a, b) => a.order - b.order);
          if (blocks.length === 0) {
            writeWrapped('(No content)', 10, 'italic', 14, theme.muted, 36);
            continue;
          }

          for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
            const block = blocks[blockIndex];
            if (blockIndex > 0) {
              const prevBlock = blocks[blockIndex - 1];
              const prevIsImageLike = prevBlock.type === 'image' || prevBlock.type === 'gallery';
              const currIsImageLike = block.type === 'image' || block.type === 'gallery';
              const gapBefore = (prevIsImageLike || currIsImageLike)
                ? Math.max(blockGap, 24)
                : blockGap;
              ensureSpace(gapBefore);
              y += gapBefore;
            }
            const raw = typeof block.content === 'string' ? block.content : '';
            const text = this.sanitizePdfText(this.htmlToPlainText(raw, block.type === 'code'));

            if (block.type === 'image') {
              if (block.imageUrl) {
                await renderImage(
                  block.imageUrl,
                  block.imageCaption ? `Caption: ${this.sanitizePdfText(block.imageCaption)}` : undefined,
                  36
                );
              } else {
                writeWrapped('Image block (no URL)', 10, 'italic', 14, theme.muted, 36);
              }
              continue;
            }

            if (block.type === 'gallery') {
              const galleryItems = Array.isArray(block.content) ? block.content : [];
              if (galleryItems.length === 0) {
                writeWrapped('Gallery - 0 image(s)', 10, 'italic', 14, theme.muted, 36);
              } else {
                writeWrapped(`Gallery - ${galleryItems.length} image(s)`, 10, 'italic', 14, theme.muted, 36);
                for (const item of galleryItems) {
                  const itemUrl = typeof item?.url === 'string' ? item.url : '';
                  if (!itemUrl) {
                    continue;
                  }
                  const itemCaption = typeof item?.caption === 'string' ? item.caption : '';
                  await renderImage(
                    itemUrl,
                    itemCaption ? `Caption: ${this.sanitizePdfText(itemCaption)}` : undefined,
                    44
                  );
                }
              }
              continue;
            }

            if (block.type === 'divider') {
              y += 3;
              ensureSpace(10);
              setStroke(theme.border);
              pdf.setLineWidth(0.6);
              pdf.line(marginLeft + 36, y, pageWidth - marginRight, y);
              y += 7;
              continue;
            }

            if (block.type === 'heading') {
              const headingSize = block.level === 1 ? 20 : block.level === 2 ? 16 : 14;
              if (this.containsHtml(raw)) {
                renderRichText(raw, {
                  size: headingSize,
                  indent: 36,
                  lineHeight: headingSize + 5,
                  baseStyle: 'bold',
                  color: theme.text
                });
              } else {
                writeWrapped(text || 'Untitled heading', headingSize, 'bold', headingSize + 5, theme.text, 36);
              }
              continue;
            }

            if (block.type === 'code') {
              renderCodeBlock(text || ' ');
              continue;
            }

            if (block.type === 'quote') {
              if (this.containsHtml(raw)) {
                renderRichText(raw, {
                  size: 12,
                  indent: 44,
                  lineHeight: 18,
                  baseStyle: 'italic',
                  color: theme.text
                });
              } else {
                writeWrapped(text || ' ', 12, 'italic', 18, theme.text, 44);
              }
              continue;
            }

            if (block.type === 'text') {
              if (this.containsHtml(raw)) {
                renderRichText(raw, {
                  size: 12,
                  indent: 36,
                  lineHeight: 18,
                  baseStyle: 'normal',
                  color: theme.text
                });
              } else {
                writeWrapped(text || '(empty)', 12, 'normal', 18, theme.text, 36);
              }
              continue;
            }

            writeWrapped(text || '(empty)', 12, 'normal', 18, theme.text, 36);
          }

        }

        y += 6;
      }

      divider(8, 22);
    }

    const pages = pdf.getNumberOfPages();
    for (let pageNum = 1; pageNum <= pages; pageNum++) {
      pdf.setPage(pageNum);
      setStroke(theme.border);
      pdf.setLineWidth(0.7);
      pdf.line(marginLeft, pageHeight - marginBottom, pageWidth - marginRight, pageHeight - marginBottom);
      setText(theme.muted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Page ${pageNum} of ${pages}`, pageWidth / 2, pageHeight - marginBottom + 16, {
        align: 'center'
      });
    }

    const safeName = this.getSafeFilename(project.name || 'project');
    pdf.save(`${safeName}-export.pdf`);
  }

  private wrapLongWords(pdf: jsPDF, lines: string[], maxWidth: number): string[] {
    const wrapped: string[] = [];
    for (const line of lines) {
      if (!line) {
        wrapped.push('');
        continue;
      }
      if (pdf.getTextWidth(line) <= maxWidth) {
        wrapped.push(line);
        continue;
      }

      let current = '';
      for (const char of line) {
        const next = current + char;
        if (pdf.getTextWidth(next) > maxWidth && current.length > 0) {
          wrapped.push(current);
          current = char;
        } else {
          current = next;
        }
      }
      if (current) {
        wrapped.push(current);
      }
    }
    return wrapped;
  }

  private sanitizePdfText(input: string, keepLineBreaks = false): string {
    let normalized = (input || '')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/[^\u0020-\u00FF\n\r\t]/g, '');

    if (keepLineBreaks) {
      normalized = normalized
        .replace(/\r/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return normalized;
    }

    return normalized.replace(/\s+/g, ' ').trim();
  }

  private loadImageForPdf(imageUrl: string): Promise<{ dataUrl: string; width: number; height: number; format: 'PNG' | 'JPEG' } | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const isPng = imageUrl.startsWith('data:image/png') || imageUrl.toLowerCase().endsWith('.png');
          const format: 'PNG' | 'JPEG' = isPng ? 'PNG' : 'JPEG';
          resolve({
            dataUrl: canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.92),
            width: canvas.width,
            height: canvas.height,
            format
          });
        } catch {
          resolve(null);
        }
      };

      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  }

  private htmlToPlainText(input: string, preserveLineBreaks = false): string {
    if (!input) return '';
    if (!/[<>&]/.test(input)) return input.trim();

    const container = document.createElement('div');
    container.innerHTML = input;
    if (preserveLineBreaks) {
      container.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
      container.querySelectorAll('p,div,li,blockquote,h1,h2,h3,h4,h5,h6,pre').forEach((el) => {
        if (el.nextSibling) {
          el.parentNode?.insertBefore(document.createTextNode('\n'), el.nextSibling);
        } else {
          el.parentNode?.appendChild(document.createTextNode('\n'));
        }
      });
    }

    let text = (container.textContent || '').replace(/\u00a0/g, ' ');
    if (preserveLineBreaks) {
      return text
        .replace(/\r/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
    return text.replace(/\s+/g, ' ').trim();
  }

  private containsHtml(input: string): boolean {
    return /<[^>]+>/.test(input || '');
  }

  private extractStyledRunsFromHtml(
    html: string,
    baseStyle: 'normal' | 'bold' | 'italic',
    baseColor: number[]
  ): ProjectPdfTextRun[] {
    const container = document.createElement('div');
    container.innerHTML = this.normalizeExportHtml(html);
    const runs: ProjectPdfTextRun[] = [];

    const walk = (node: Node, state: Omit<ProjectPdfTextRun, 'text'>): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text.length > 0) {
          runs.push({ text, ...state });
        }
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const next: Omit<ProjectPdfTextRun, 'text'> = {
        ...state,
        color: state.color ? [...state.color] : baseColor
      };

      if (tag === 'strong' || tag === 'b') next.bold = true;
      if (tag === 'em' || tag === 'i') next.italic = true;
      if (tag === 'u') next.underline = true;
      if (tag === 'mark') next.backgroundColor = [254, 243, 205];
      if (tag === 'br') {
        runs.push({ text: '\n', ...next });
        return;
      }

      if (tag === 'font') {
        const fontColor = el.getAttribute('color');
        if (fontColor) {
          const parsedFontColor = this.parseCssColor(fontColor);
          if (parsedFontColor) {
            next.color = parsedFontColor;
          }
        }
      }

      const style = el.style;
      if (style.color) {
        const parsed = this.parseCssColor(style.color);
        if (parsed) next.color = parsed;
      }
      if (style.backgroundColor) {
        const parsedBg = this.parseCssColor(style.backgroundColor);
        if (parsedBg) next.backgroundColor = parsedBg;
      }
      if (style.fontWeight) {
        const fw = style.fontWeight.toLowerCase();
        if (fw === 'bold' || Number(fw) >= 600) next.bold = true;
      }
      if (style.fontStyle && style.fontStyle.toLowerCase() === 'italic') {
        next.italic = true;
      }
      if (
        (style.textDecoration || '').toLowerCase().includes('underline') ||
        (style.textDecorationLine || '').toLowerCase().includes('underline')
      ) {
        next.underline = true;
      }

      const dataBg = el.getAttribute('bgcolor');
      if (dataBg) {
        const parsedBg = this.parseCssColor(dataBg);
        if (parsedBg) next.backgroundColor = parsedBg;
      }

      const isBlock = ['div', 'p', 'li', 'blockquote', 'pre', 'h1', 'h2', 'h3'].includes(tag);
      if (isBlock && runs.length > 0 && !runs[runs.length - 1].text.endsWith('\n')) {
        runs.push({ text: '\n', ...next });
      }

      el.childNodes.forEach((child) => walk(child, next));

      if (isBlock && runs.length > 0 && !runs[runs.length - 1].text.endsWith('\n')) {
        runs.push({ text: '\n', ...next });
      }
    };

    const initial: Omit<ProjectPdfTextRun, 'text'> = {
      bold: baseStyle === 'bold',
      italic: baseStyle === 'italic',
      underline: false,
      color: baseColor
    };
    container.childNodes.forEach((child) => walk(child, initial));

    return runs;
  }

  private parseCssColor(value: string): number[] | null {
    const input = (value || '').trim().toLowerCase();
    if (!input || input === 'transparent') {
      return null;
    }

    const hex = input.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      const v = hex[1];
      if (v.length === 3) {
        return [
          parseInt(v[0] + v[0], 16),
          parseInt(v[1] + v[1], 16),
          parseInt(v[2] + v[2], 16)
        ];
      }
      return [
        parseInt(v.slice(0, 2), 16),
        parseInt(v.slice(2, 4), 16),
        parseInt(v.slice(4, 6), 16)
      ];
    }

    const rgb = input.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgb) {
      return [
        Math.max(0, Math.min(255, Number(rgb[1]))),
        Math.max(0, Math.min(255, Number(rgb[2]))),
        Math.max(0, Math.min(255, Number(rgb[3])))
      ];
    }

    const probe = document.createElement('span');
    probe.style.color = input;
    if (probe.style.color) {
      const normalized = probe.style.color.toLowerCase();
      const normalizedRgb = normalized.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (normalizedRgb) {
        return [
          Math.max(0, Math.min(255, Number(normalizedRgb[1]))),
          Math.max(0, Math.min(255, Number(normalizedRgb[2]))),
          Math.max(0, Math.min(255, Number(normalizedRgb[3])))
        ];
      }
    }

    return null;
  }

  private normalizeExportHtml(input: string): string {
    if (!input) {
      return '';
    }

    return input
      .replace(/\sclass="[^"]*ng-star-inserted[^"]*"/gi, '')
      .replace(/\scontenteditable="[^"]*"/gi, '')
      .replace(/\sdata-placeholder="[^"]*"/gi, '');
  }
}
