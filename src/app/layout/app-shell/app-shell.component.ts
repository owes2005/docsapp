import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { jsPDF } from 'jspdf';
import { DocumentService } from 'src/app/core/services/document.service';
import { PageService } from 'src/app/core/services/page.service';

interface PdfTheme {
  primaryColor: number[];
  textColor: number[];
  mutedColor: number[];
  codeBackground: number[];
  fontFamily: string;
}

interface PdfLayout {
  marginLeft: number;
  marginRight: number;
  marginBottom: number;
  headerHeight: number;
  footerHeight: number;
  sectionGap: number;
}

interface PdfRenderContext {
  pdf: jsPDF;
  theme: PdfTheme;
  layout: PdfLayout;
  docTitle: string;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  y: number;
}

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
  // Set this to a base64 data URI (e.g. data:image/png;base64,...) to show a logo in PDF headers.
  private readonly pdfLogoBase64: string | null = null;
  
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
      const theme = this.applyTheme();
      const layout: PdfLayout = {
        marginLeft: 48,
        marginRight: 48,
        marginBottom: 44,
        headerHeight: 64,
        footerHeight: 34,
        sectionGap: 12
      };
      const context: PdfRenderContext = {
        pdf,
        theme,
        layout,
        docTitle: this.currentDocTitle || 'Untitled',
        pageWidth: pdf.internal.pageSize.getWidth(),
        pageHeight: pdf.internal.pageSize.getHeight(),
        contentWidth: pdf.internal.pageSize.getWidth() - layout.marginLeft - layout.marginRight,
        y: layout.headerHeight + 20
      };

      this.addHeader(context);

      for (let pageIndex = 0; pageIndex < sortedPages.length; pageIndex++) {
        const page = sortedPages[pageIndex];
        if (pageIndex > 0) {
          this.startNewPage(context);
        }

        this.renderHeading(context, `${pageIndex + 1}. ${page.title || 'Untitled page'}`, 2);

        const blocks = [...(page.content?.blocks || [])].sort((a, b) => a.order - b.order);
        if (blocks.length === 0) {
          this.renderParagraph(context, '(No content)', {
            size: 10,
            style: 'italic',
            color: context.theme.mutedColor
          });
          continue;
        }

        for (const block of blocks) {
          const textContent = typeof block.content === 'string' ? block.content : '';

          switch (block.type) {
            case 'heading': {
              const level = block.level || 1;
              const headingText = textContent || 'Untitled heading';
              this.renderHeading(context, headingText, level);
              break;
            }
            case 'text':
              this.renderParagraph(context, textContent || ' ');
              break;
            case 'quote':
              this.renderParagraph(context, `"${textContent || ''}"`, {
                style: 'italic'
              });
              break;
            case 'code':
              this.renderCodeBlock(context, textContent || ' ');
              break;
            case 'divider':
              this.ensureSpace(context, 16);
              this.setStrokeColor(context, context.theme.mutedColor);
              context.pdf.setLineWidth(0.8);
              context.pdf.line(
                context.layout.marginLeft,
                context.y,
                context.pageWidth - context.layout.marginRight,
                context.y
              );
              context.y += context.layout.sectionGap;
              break;
            case 'image': {
              if (block.imageUrl) {
                const ok = await this.renderImage(context, block.imageUrl, 300);
                if (!ok) {
                  this.renderParagraph(context, '[Image could not be embedded]', {
                    size: 10,
                    style: 'italic',
                    color: context.theme.mutedColor
                  });
                }
              } else {
                this.renderParagraph(context, '[Image placeholder]', {
                  size: 10,
                  style: 'italic',
                  color: context.theme.mutedColor
                });
              }
              if (block.imageCaption) {
                this.renderParagraph(context, `Caption: ${block.imageCaption}`, {
                  size: 10,
                  style: 'normal',
                  color: context.theme.mutedColor
                });
              }
              break;
            }
            case 'gallery': {
              const galleryItems = Array.isArray(block.content) ? block.content : [];
              if (galleryItems.length === 0) {
                this.renderParagraph(context, '[Gallery: 0 image(s)]', {
                  size: 10,
                  style: 'italic',
                  color: context.theme.mutedColor
                });
              } else {
                this.renderParagraph(context, `[Gallery: ${galleryItems.length} image(s)]`, {
                  size: 10,
                  style: 'italic',
                  color: context.theme.mutedColor
                });
                for (const item of galleryItems) {
                  const itemUrl = typeof item?.url === 'string' ? item.url : '';
                  if (!itemUrl) {
                    continue;
                  }
                  const ok = await this.renderImage(context, itemUrl, 220);
                  if (!ok) {
                    this.renderParagraph(context, '[Gallery image could not be embedded]', {
                      size: 10,
                      style: 'italic',
                      color: context.theme.mutedColor
                    });
                  }
                  const itemCaption = typeof item?.caption === 'string' ? item.caption : '';
                  if (itemCaption) {
                    this.renderParagraph(context, `Caption: ${itemCaption}`, {
                      size: 10,
                      style: 'normal',
                      color: context.theme.mutedColor
                    });
                  }
                }
              }
              break;
            }
            default:
              this.renderParagraph(context, textContent || ' ');
              break;
          }

          context.y += 4;
        }
      }

      this.addPageNumbers(context);
      const safeName = this.getSafeFilename(this.currentDocTitle || 'document');
      pdf.save(`${safeName}.pdf`);
    } catch (error) {
      console.error('Export PDF failed:', error);
      alert('Failed to export PDF. Please try again.');
    }
  }

  private applyTheme(): PdfTheme {
    return {
      primaryColor: [26, 54, 93],
      textColor: [33, 37, 41],
      mutedColor: [120, 130, 145],
      codeBackground: [245, 247, 250],
      fontFamily: 'helvetica'
    };
  }

  private addHeader(context: PdfRenderContext): void {
    const { pdf, layout, pageWidth, docTitle } = context;
    const headerCenterY = 30;

    if (this.pdfLogoBase64) {
      try {
        pdf.addImage(this.pdfLogoBase64, 'PNG', layout.marginLeft, 16, 18, 18);
      } catch {
        // Ignore logo failures and continue export.
      }
    }

    this.setTextColor(context, context.theme.primaryColor);
    pdf.setFont(context.theme.fontFamily, 'bold');
    pdf.setFontSize(11);
    pdf.text(docTitle, pageWidth / 2, headerCenterY, { align: 'center' });

    this.setStrokeColor(context, context.theme.mutedColor);
    pdf.setLineWidth(0.6);
    pdf.line(layout.marginLeft, layout.headerHeight - 4, pageWidth - layout.marginRight, layout.headerHeight - 4);

    context.y = layout.headerHeight + 20;
  }

  private renderHeading(context: PdfRenderContext, text: string, level: number): void {
    if (!text.trim()) return;

    const normalizedLevel = Math.min(Math.max(level || 1, 1), 3);
    const size = normalizedLevel === 1 ? 20 : normalizedLevel === 2 ? 16 : 14;
    const lineHeight = size + 6;

    context.y += normalizedLevel === 1 ? 8 : 4;
    this.ensureSpace(context, lineHeight + context.layout.sectionGap);

    context.pdf.setFont(context.theme.fontFamily, 'bold');
    context.pdf.setFontSize(size);
    this.setTextColor(context, context.theme.textColor);

    const lines = context.pdf.splitTextToSize(text, context.contentWidth);
    for (const line of lines) {
      this.ensureSpace(context, lineHeight);
      context.pdf.text(line, context.layout.marginLeft, context.y);
      context.y += lineHeight;
    }

    context.y += 6;
  }

  private renderParagraph(
    context: PdfRenderContext,
    text: string,
    options?: {
      size?: number;
      style?: 'normal' | 'bold' | 'italic';
      color?: number[];
    }
  ): void {
    if (!text.trim()) return;

    const fontSize = options?.size ?? 12;
    const fontStyle = options?.style ?? 'normal';
    const color = options?.color ?? context.theme.textColor;
    const lineHeight = fontSize === 10 ? 14 : 18;

    context.pdf.setFont(context.theme.fontFamily, fontStyle);
    context.pdf.setFontSize(fontSize);
    this.setTextColor(context, color);

    const lines = context.pdf.splitTextToSize(text, context.contentWidth);
    this.ensureSpace(context, lines.length * lineHeight + 6);

    for (const line of lines) {
      this.ensureSpace(context, lineHeight);
      context.pdf.text(line, context.layout.marginLeft, context.y);
      context.y += lineHeight;
    }

    context.y += 6;
  }

  private renderCodeBlock(context: PdfRenderContext, text: string): void {
    const fontSize = 10;
    const lineHeight = 13;
    const padding = 10;
    const borderRadius = 4;
    const spacingBefore = 8;
    const spacingAfter = 10;

    context.pdf.setFont('courier', 'normal');
    context.pdf.setFontSize(fontSize);
    const codeLines = context.pdf.splitTextToSize(text || ' ', context.contentWidth - padding * 2);
    const blockHeight = codeLines.length * lineHeight + padding * 2;

    context.y += spacingBefore;
    this.ensureSpace(context, blockHeight + spacingAfter);

    const x = context.layout.marginLeft;
    const y = context.y;

    this.setFillColor(context, context.theme.codeBackground);
    this.setStrokeColor(context, context.theme.mutedColor);
    context.pdf.setLineWidth(0.5);
    context.pdf.roundedRect(x, y, context.contentWidth, blockHeight, borderRadius, borderRadius, 'FD');

    this.setTextColor(context, context.theme.textColor);
    let textY = y + padding + 8;
    for (const line of codeLines) {
      context.pdf.text(line, x + padding, textY);
      textY += lineHeight;
    }

    context.y += blockHeight + spacingAfter;
  }

  private async renderImage(context: PdfRenderContext, imageUrl: string, maxImageHeight = 260): Promise<boolean> {
    const imageData = await this.loadImageForPdf(imageUrl);
    if (!imageData) {
      return false;
    }

    const maxWidth = context.contentWidth;
    const widthRatio = maxWidth / imageData.width;
    const heightRatio = maxImageHeight / imageData.height;
    const scale = Math.min(widthRatio, heightRatio, 1);
    const drawWidth = imageData.width * scale;
    const drawHeight = imageData.height * scale;
    const x = context.layout.marginLeft + (context.contentWidth - drawWidth) / 2;

    this.ensureSpace(context, drawHeight + 16);
    context.pdf.addImage(imageData.dataUrl, imageData.format, x, context.y, drawWidth, drawHeight);

    this.setStrokeColor(context, [225, 230, 238]);
    context.pdf.setLineWidth(0.5);
    context.pdf.rect(x, context.y, drawWidth, drawHeight);

    context.y += drawHeight + 10;
    return true;
  }

  private addPageNumbers(context: PdfRenderContext): void {
    const totalPages = context.pdf.getNumberOfPages();

    for (let page = 1; page <= totalPages; page++) {
      context.pdf.setPage(page);

      const footerY = context.pageHeight - context.layout.footerHeight + 8;
      this.setStrokeColor(context, context.theme.mutedColor);
      context.pdf.setLineWidth(0.5);
      context.pdf.line(
        context.layout.marginLeft,
        context.pageHeight - context.layout.footerHeight - 8,
        context.pageWidth - context.layout.marginRight,
        context.pageHeight - context.layout.footerHeight - 8
      );

      context.pdf.setFont(context.theme.fontFamily, 'normal');
      context.pdf.setFontSize(10);
      this.setTextColor(context, context.theme.mutedColor);
      context.pdf.text(`Page ${page} of ${totalPages}`, context.pageWidth / 2, footerY, { align: 'center' });
    }
  }

  private ensureSpace(context: PdfRenderContext, heightNeeded: number): void {
    const maxY = context.pageHeight - context.layout.marginBottom - context.layout.footerHeight;
    if (context.y + heightNeeded > maxY) {
      this.startNewPage(context);
    }
  }

  private startNewPage(context: PdfRenderContext): void {
    context.pdf.addPage();
    this.addHeader(context);
  }

  private setTextColor(context: PdfRenderContext, color: number[]): void {
    context.pdf.setTextColor(color[0] || 0, color[1] || 0, color[2] || 0);
  }

  private setFillColor(context: PdfRenderContext, color: number[]): void {
    context.pdf.setFillColor(color[0] || 0, color[1] || 0, color[2] || 0);
  }

  private setStrokeColor(context: PdfRenderContext, color: number[]): void {
    context.pdf.setDrawColor(color[0] || 0, color[1] || 0, color[2] || 0);
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
