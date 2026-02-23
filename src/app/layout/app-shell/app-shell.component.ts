import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { jsPDF } from 'jspdf';
import { DocumentService } from 'src/app/core/services/document.service';
import { PageService } from 'src/app/core/services/page.service';
import { ContentBlock } from 'src/app/core/models/page.model';

@Component({
  selector: 'app-shell',
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.css']
})
export class AppShellComponent implements OnInit {
  showMainSidebar = true;
  currentRoute = '';
  currentDocTitle = 'Untitled';
  currentDocId: string | null = null;
  
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private documentService: DocumentService,
    private pageService: PageService
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

  async exportDocumentPdf(): Promise<void> {
    if (!this.currentDocId) {
      alert('No active document found to export.');
      return;
    }

    try {
      const pages = await firstValueFrom(this.pageService.getPagesByDocument(this.currentDocId));
      const sortedPages = [...pages].sort((a, b) => a.order - b.order);

      if (sortedPages.length === 0) {
        alert('This document has no pages to export.');
        return;
      }

      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 40;
      const maxWidth = pageWidth - margin * 2;
      let y = margin;

      const ensureSpace = (heightNeeded: number): void => {
        if (y + heightNeeded > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
      };

      const writeWrappedText = (
        text: string,
        fontSize: number,
        lineHeight: number,
        style: 'normal' | 'bold' | 'italic' = 'normal'
      ): void => {
        if (!text.trim()) return;
        pdf.setFont('helvetica', style);
        pdf.setFontSize(fontSize);
        const lines = pdf.splitTextToSize(text, maxWidth);
        for (const line of lines) {
          ensureSpace(lineHeight);
          pdf.text(line, margin, y);
          y += lineHeight;
        }
      };

      const addImageBlock = async (imageUrl: string, maxImageHeight = 260): Promise<boolean> => {
        const imageData = await this.loadImageForPdf(imageUrl);
        if (!imageData) {
          return false;
        }

        const widthRatio = maxWidth / imageData.width;
        const heightRatio = maxImageHeight / imageData.height;
        const scale = Math.min(widthRatio, heightRatio, 1);
        const drawWidth = imageData.width * scale;
        const drawHeight = imageData.height * scale;

        ensureSpace(drawHeight + 6);
        pdf.addImage(imageData.dataUrl, imageData.format, margin, y, drawWidth, drawHeight);
        y += drawHeight + 6;
        return true;
      };

      const drawDivider = (): void => {
        ensureSpace(12);
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(1);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 12;
      };

      writeWrappedText(this.currentDocTitle || 'Untitled', 18, 24, 'bold');
      y += 8;

      for (let pageIndex = 0; pageIndex < sortedPages.length; pageIndex++) {
        const page = sortedPages[pageIndex];
        if (pageIndex > 0) {
          pdf.addPage();
          y = margin;
        }

        writeWrappedText(`${pageIndex + 1}. ${page.title || 'Untitled page'}`, 15, 20, 'bold');
        y += 4;

        const blocks = [...(page.content?.blocks || [])].sort((a, b) => a.order - b.order);
        if (blocks.length === 0) {
          writeWrappedText('(No content)', 11, 16, 'italic');
          y += 6;
          continue;
        }

        for (const block of blocks) {
          const textContent = typeof block.content === 'string' ? block.content : '';

          switch (block.type) {
            case 'heading': {
              const level = block.level || 1;
              const size = level === 1 ? 14 : level === 2 ? 13 : 12;
              writeWrappedText(textContent || ' ', size, 18, 'bold');
              break;
            }
            case 'text':
              writeWrappedText(textContent || ' ', 11, 16, 'normal');
              break;
            case 'quote':
              writeWrappedText(`"${textContent || ''}"`, 11, 16, 'italic');
              break;
            case 'code':
              writeWrappedText(textContent || ' ', 10, 14, 'normal');
              break;
            case 'divider':
              drawDivider();
              break;
            case 'image': {
              if (block.imageUrl) {
                const ok = await addImageBlock(block.imageUrl, 300);
                if (!ok) {
                  writeWrappedText('[Image could not be embedded]', 11, 16, 'italic');
                }
              } else {
                writeWrappedText('[Image placeholder]', 11, 16, 'italic');
              }
              if (block.imageCaption) {
                writeWrappedText(`Caption: ${block.imageCaption}`, 10, 14, 'normal');
              }
              break;
            }
            case 'gallery': {
              const galleryItems = Array.isArray(block.content) ? block.content : [];
              if (galleryItems.length === 0) {
                writeWrappedText('[Gallery: 0 image(s)]', 11, 16, 'italic');
              } else {
                writeWrappedText(`[Gallery: ${galleryItems.length} image(s)]`, 11, 16, 'italic');
                for (const item of galleryItems) {
                  const itemUrl = typeof item?.url === 'string' ? item.url : '';
                  if (!itemUrl) {
                    continue;
                  }
                  const ok = await addImageBlock(itemUrl, 220);
                  if (!ok) {
                    writeWrappedText('[Gallery image could not be embedded]', 10, 14, 'italic');
                  }
                  const itemCaption = typeof item?.caption === 'string' ? item.caption : '';
                  if (itemCaption) {
                    writeWrappedText(`Caption: ${itemCaption}`, 10, 14, 'normal');
                  }
                }
              }
              break;
            }
            default:
              writeWrappedText(textContent || ' ', 11, 16, 'normal');
              break;
          }

          y += 6;
        }
      }

      const safeName = this.getSafeFilename(this.currentDocTitle || 'document');
      pdf.save(`${safeName}.pdf`);
    } catch (error) {
      console.error('Export PDF failed:', error);
      alert('Failed to export PDF. Please try again.');
    }
  }

  private updateFromRoute(): void {
    let activeRoute = this.route;
    while (activeRoute.firstChild) {
      activeRoute = activeRoute.firstChild;
    }

    const docId = activeRoute.snapshot.paramMap.get('documentId');
    this.currentDocId = docId;

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
          const isPng = imageUrl.startsWith('data:image/png') || imageUrl.endsWith('.png');
          const mimeType = isPng ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(mimeType, 0.9);
          resolve({
            dataUrl,
            width: canvas.width,
            height: canvas.height,
            format: isPng ? 'PNG' : 'JPEG'
          });
        } catch {
          resolve(null);
        }
      };

      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  }

  private getSafeFilename(input: string): string {
    return input
      .trim()
      .replace(/[<>:"/\\|?*]+/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 100) || 'document';
  }
}
