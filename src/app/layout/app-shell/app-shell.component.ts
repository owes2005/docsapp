import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { jsPDF } from 'jspdf';
import { DocumentService } from 'src/app/core/services/document.service';
import { PageService } from 'src/app/core/services/page.service';
import { Page } from 'src/app/core/models/page.model';

interface PdfTheme {
  primaryColor: number[];
  textColor: number[];
  mutedColor: number[];
  borderColor: number[];
  sectionBackground: number[];
  fontFamily: string;
}

interface PdfLayout {
  marginLeft: number;
  marginRight: number;
  marginBottom: number;
  headerHeight: number;
  footerHeight: number;
  sectionGap: number;
  blockGap: number;
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
  leftLogo?: { dataUrl: string; width: number; height: number; format: 'PNG' | 'JPEG' } | null;
  rightLogo?: { dataUrl: string; width: number; height: number; format: 'PNG' | 'JPEG' } | null;
}

interface PdfTextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color?: number[];
  backgroundColor?: number[];
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
  private readonly coverImagePath = encodeURI('assets/Optima User Manual page.jpg');
  private readonly leftHeaderLogoPath = encodeURI('assets/OPTIMANEW.svg');
  private readonly rightHeaderLogoPath = encodeURI('assets/KELLTON2.svg');
  // Set this to a base64 data URI (e.g. data:image/png;base64,...) to show a logo in PDF headers.
  private readonly pdfLogoBase64: string | null = null;
  private pdfImagePromiseCache = new Map<
    string,
    Promise<{ dataUrl: string; width: number; height: number; format: 'PNG' | 'JPEG' } | null>
  >();
  
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
      // Keep shell controls (sidebar/export title) synced with route changes.
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

  isDocumentsList(): boolean {
    return this.currentRoute.startsWith('/documents');
  }

  async exportDocumentPdf(): Promise<void> {
    if (!this.currentDocId) {
      alert('No active document found to export.');
      return;
    }

    try {
      const pages = await firstValueFrom(this.pageService.getPagesByDocument(this.currentDocId));
      await this.exportPagesPdf(
        pages,
        this.currentDocTitle || 'Untitled',
        this.getSafeFilename(this.currentDocTitle || 'document')
      );
    } catch (error) {
      console.error('Export PDF failed:', error);
      alert('Failed to export PDF. Please try again.');
    }
  }

  async exportCurrentPagePdf(): Promise<void> {
    if (!this.currentDocId) {
      alert('No active document found to export.');
      return;
    }

    try {
      const pages = await firstValueFrom(this.pageService.getPagesByDocument(this.currentDocId));
      const activePageId = this.pageService.getActivePageId();
      const activePage = activePageId ? pages.find((p) => p.id === activePageId) : null;

      if (!activePage) {
        alert('No active page selected to export.');
        return;
      }

      const pageTitle = activePage.title || 'Untitled page';
      const fileName = `${this.getSafeFilename(this.currentDocTitle || 'document')}-${this.getSafeFilename(pageTitle)}`;
      await this.exportPagesPdf([activePage], pageTitle, fileName);
    } catch (error) {
      console.error('Export current page PDF failed:', error);
      alert('Failed to export page PDF. Please try again.');
    }
  }

  private async exportPagesPdf(
    pages: Page[],
    exportTitle: string,
    fileNameBase: string
  ): Promise<void> {
    const sortedPages = [...pages].sort((a, b) => a.order - b.order);

    if (sortedPages.length === 0) {
      alert('This selection has no pages to export.');
      return;
    }

      // Reset per-export cache and preload all content images in parallel.
      this.pdfImagePromiseCache.clear();
      await this.preloadPdfImagesForPages(sortedPages);

      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const theme = this.applyTheme();
      const hasCover = await this.renderCoverPage(pdf, this.coverImagePath);
      if (hasCover) {
        pdf.addPage();
      }
      const layout: PdfLayout = {
        marginLeft: 50,
        marginRight: 50,
        marginBottom: 54,
        headerHeight: 62,
        footerHeight: 20,
        sectionGap: 20,
        blockGap: 16
      };
      const [leftLogo, rightLogo] = await Promise.all([
        this.loadImageForPdf(this.leftHeaderLogoPath),
        this.loadImageForPdf(this.rightHeaderLogoPath)
      ]);
      const context: PdfRenderContext = {
        pdf,
        theme,
        layout,
        docTitle: exportTitle || 'Untitled',
        pageWidth: pdf.internal.pageSize.getWidth(),
        pageHeight: pdf.internal.pageSize.getHeight(),
        contentWidth: pdf.internal.pageSize.getWidth() - layout.marginLeft - layout.marginRight,
        y: layout.headerHeight + 20,
        leftLogo,
        rightLogo
      };

      // Cover + header are handled before content loop so page numbering remains clean.
      this.addHeader(context);
      this.renderHeading(context, context.docTitle || 'Untitled', 1);
      this.renderParagraph(
        context,
        `Pages ${sortedPages.length}`,
        { size: 10, style: 'normal', color: context.theme.mutedColor, lineHeight: 14 }
      );
      this.setStrokeColor(context, context.theme.mutedColor);
      context.pdf.setLineWidth(0.8);
      this.ensureSpace(context, 16);
      context.pdf.line(
        context.layout.marginLeft,
        context.y + 4,
        context.pageWidth - context.layout.marginRight,
        context.y + 4
      );
      context.y += 22;

      for (let pageIndex = 0; pageIndex < sortedPages.length; pageIndex++) {
        const page = sortedPages[pageIndex];
        if (pageIndex > 0) {
          this.startNewPage(context);
        }

        this.renderSectionHeader(context, `Page ${pageIndex + 1}: ${page.title || 'Untitled page'}`);

        const blocks = [...(page.content?.blocks || [])].sort((a, b) => a.order - b.order);
        if (blocks.length === 0) {
          this.renderParagraph(context, 'No content', {
            size: 10,
            style: 'italic',
            color: context.theme.mutedColor
          });
          continue;
        }

        for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
          const block = blocks[blockIndex];
          if (blockIndex > 0) {
            const prevBlock = blocks[blockIndex - 1];
            const prevIsImageLike = prevBlock.type === 'image' || prevBlock.type === 'gallery';
            const currIsImageLike = block.type === 'image' || block.type === 'gallery';
            const gapBefore = (prevIsImageLike || currIsImageLike)
              ? Math.max(context.layout.blockGap, 24)
              : context.layout.blockGap;
            this.ensureSpace(context, gapBefore);
            context.y += gapBefore;
          }
          const rawContent = typeof block.content === 'string' ? block.content : '';
          const textContent = this.htmlToPlainText(rawContent);
          const hasHtmlFormatting = this.containsHtml(rawContent);

          switch (block.type) {
            case 'heading': {
              const level = block.level || 1;
              const headingText = textContent || 'Untitled heading';
              if (hasHtmlFormatting) {
                this.renderRichText(context, rawContent, {
                  size: level === 1 ? 20 : level === 2 ? 16 : 14,
                  style: 'bold',
                  indent: 16
                });
              } else {
                this.renderHeading(context, headingText, level, 16);
              }
              break;
            }
            case 'text':
              if (hasHtmlFormatting) {
                this.renderRichText(context, rawContent, {
                  size: 12,
                  style: 'normal',
                  indent: 16
                });
              } else {
                this.renderParagraph(context, textContent || ' ', { indent: 16 });
              }
              break;
            case 'divider':
              this.ensureSpace(context, 16);
              this.setStrokeColor(context, context.theme.mutedColor);
              context.pdf.setLineWidth(0.8);
              context.pdf.line(
                context.layout.marginLeft + 16,
                context.y,
                context.pageWidth - context.layout.marginRight - 16,
                context.y
              );
              context.y += 14;
              break;
            case 'image': {
              const image = this.getImageBlockData(block);
              if (image.url) {
                const ok = await this.renderImage(context, image.url, 300, 16);
                if (!ok) {
                  this.renderParagraph(context, 'Image could not be embedded', {
                    size: 10,
                    style: 'italic',
                    color: context.theme.mutedColor,
                    indent: 16
                  });
                }
              } else {
                this.renderParagraph(context, 'Image unavailable', {
                  size: 10,
                  style: 'italic',
                  color: context.theme.mutedColor,
                  indent: 16
                });
              }
              if (image.caption) {
                this.renderParagraph(context, `Caption: ${image.caption}`, {
                  size: 10,
                  style: 'normal',
                  color: context.theme.mutedColor,
                  indent: 20
                });
              }
              break;
            }
            case 'gallery': {
              const galleryItems = Array.isArray(block.content) ? block.content : [];
              if (galleryItems.length === 0) {
                this.renderParagraph(context, 'Gallery: no images', {
                  size: 10,
                  style: 'italic',
                  color: context.theme.mutedColor,
                  indent: 16
                });
              } else {
                this.renderParagraph(context, `Gallery: ${galleryItems.length} image(s)`, {
                  size: 10,
                  style: 'italic',
                  color: context.theme.mutedColor,
                  indent: 16
                });
                for (const item of galleryItems) {
                  const itemUrl = typeof item?.url === 'string' ? item.url : '';
                  if (!itemUrl) {
                    continue;
                  }
                  const ok = await this.renderImage(context, itemUrl, 220, 24);
                  if (!ok) {
                    this.renderParagraph(context, 'Gallery image could not be embedded', {
                      size: 10,
                      style: 'italic',
                      color: context.theme.mutedColor,
                      indent: 24
                    });
                  }
                  const itemCaption = typeof item?.caption === 'string' ? item.caption : '';
                  if (itemCaption) {
                    this.renderParagraph(context, `Caption: ${itemCaption}`, {
                      size: 10,
                      style: 'normal',
                      color: context.theme.mutedColor,
                      indent: 28
                    });
                  }
                }
              }
              break;
            }
            default:
              this.renderParagraph(context, textContent || ' ', { indent: 16 });
              break;
          }

        }
      }

      this.addPageNumbers(context);
      const safeName = this.getSafeFilename(fileNameBase || 'document');
      pdf.save(`${safeName}.pdf`);
  }

  private applyTheme(): PdfTheme {
    return {
      primaryColor: [26, 54, 93],
      textColor: [33, 37, 41],
      mutedColor: [120, 130, 145],
      borderColor: [226, 232, 240],
      sectionBackground: [248, 250, 252],
      fontFamily: 'helvetica'
    };
  }

  private async renderCoverPage(pdf: jsPDF, imageUrl: string): Promise<boolean> {
    const imageData = await this.loadImageForPdf(imageUrl);
    if (!imageData) {
      return false;
    }

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const widthRatio = pageWidth / imageData.width;
    const heightRatio = pageHeight / imageData.height;
    const scale = Math.min(widthRatio, heightRatio);
    const drawWidth = imageData.width * scale;
    const drawHeight = imageData.height * scale;
    const x = (pageWidth - drawWidth) / 2;
    const y = (pageHeight - drawHeight) / 2;

    pdf.addImage(imageData.dataUrl, imageData.format, x, y, drawWidth, drawHeight);
    return true;
  }

  private addHeader(context: PdfRenderContext): void {
    const { pdf, layout, pageWidth } = context;

    if (context.leftLogo) {
      const targetHeight = 20;
      const scale = targetHeight / context.leftLogo.height;
      const drawWidth = context.leftLogo.width * scale;
      const drawHeight = context.leftLogo.height * scale;
      pdf.addImage(context.leftLogo.dataUrl, context.leftLogo.format, layout.marginLeft, 22, drawWidth, drawHeight);
    }

    if (context.rightLogo) {
      const targetHeight = 20;
      const scale = targetHeight / context.rightLogo.height;
      const drawWidth = context.rightLogo.width * scale;
      const drawHeight = context.rightLogo.height * scale;
      pdf.addImage(
        context.rightLogo.dataUrl,
        context.rightLogo.format,
        pageWidth - layout.marginRight - drawWidth,
        22,
        drawWidth,
        drawHeight
      );
    }

    if (this.pdfLogoBase64) {
      try {
        pdf.addImage(this.pdfLogoBase64, 'PNG', layout.marginLeft, 20, 16, 16);
      } catch {
        // Ignore logo failures and continue export.
      }
    }


    this.setStrokeColor(context, context.theme.mutedColor);
    pdf.setLineWidth(0.8);
    pdf.line(layout.marginLeft, layout.headerHeight - 10, pageWidth - layout.marginRight, layout.headerHeight - 10);

    context.y = layout.headerHeight + 26;
  }

  private renderSectionHeader(context: PdfRenderContext, text: string): void {
    if (!text.trim()) return;

    const fontSize = 12;
    const lineHeight = 16;
    const paddingX = 12;
    const paddingY = 7;
    const boxWidth = context.contentWidth;

    context.pdf.setFont(context.theme.fontFamily, 'bold');
    context.pdf.setFontSize(fontSize);
    this.setTextColor(context, context.theme.primaryColor);

    const lines = context.pdf.splitTextToSize(text, boxWidth - paddingX * 2);
    const boxHeight = lines.length * lineHeight + paddingY * 2;

    this.ensureSpace(context, boxHeight + 8);
    this.setFillColor(context, context.theme.sectionBackground);
    this.setStrokeColor(context, context.theme.borderColor);
    context.pdf.setLineWidth(0.6);
    context.pdf.roundedRect(
      context.layout.marginLeft,
      context.y,
      boxWidth,
      boxHeight,
      5,
      5,
      'FD'
    );

    let textY = context.y + paddingY + lineHeight - 4;
    for (const line of lines) {
      context.pdf.text(line, context.layout.marginLeft + paddingX, textY);
      textY += lineHeight;
    }

    context.y += boxHeight + 8;
  }

  private renderHeading(context: PdfRenderContext, text: string, level: number, indent = 0): void {
    if (!text.trim()) return;

    const normalizedLevel = Math.min(Math.max(level || 1, 1), 3);
    const size = normalizedLevel === 1 ? 20 : normalizedLevel === 2 ? 16 : 14;
    const lineHeight = size + 5;
    const startX = context.layout.marginLeft + indent;
    const width = Math.max(context.contentWidth - indent * 2, 120);

    context.y += normalizedLevel === 1 ? 8 : 4;
    this.ensureSpace(context, lineHeight + context.layout.sectionGap);

    context.pdf.setFont(context.theme.fontFamily, 'bold');
    context.pdf.setFontSize(size);
    this.setTextColor(context, context.theme.textColor);

    const lines = context.pdf.splitTextToSize(text, width);
    for (const line of lines) {
      this.ensureSpace(context, lineHeight);
      context.pdf.text(line, startX, context.y);
      context.y += lineHeight;
    }

    context.y += 5;
  }

  private renderParagraph(
    context: PdfRenderContext,
    text: string,
    options?: {
      size?: number;
      style?: 'normal' | 'bold' | 'italic';
      color?: number[];
      indent?: number;
      lineHeight?: number;
    }
  ): void {
    if (!text.trim()) return;

    const fontSize = options?.size ?? 12;
    const fontStyle = options?.style ?? 'normal';
    const color = options?.color ?? context.theme.textColor;
    const indent = options?.indent ?? 0;
    const lineHeight = options?.lineHeight ?? (fontSize === 10 ? 14 : 17);
    const startX = context.layout.marginLeft + indent;
    const width = Math.max(context.contentWidth - indent * 2, 120);

    context.pdf.setFont(context.theme.fontFamily, fontStyle);
    context.pdf.setFontSize(fontSize);
    this.setTextColor(context, color);

    const lines = context.pdf.splitTextToSize(text, width);
    this.ensureSpace(context, lines.length * lineHeight + 5);

    for (const line of lines) {
      this.ensureSpace(context, lineHeight);
      context.pdf.text(line, startX, context.y);
      context.y += lineHeight;
    }

    context.y += 5;
  }

  private renderRichText(
    context: PdfRenderContext,
    html: string,
    options?: {
      size?: number;
      style?: 'normal' | 'bold' | 'italic';
      color?: number[];
      indent?: number;
      lineHeight?: number;
    }
  ): void {
    // Styled-run rendering preserves inline formatting from rich-text blocks.
    const runs = this.extractStyledRunsFromHtml(
      html,
      options?.style ?? 'normal',
      options?.color ?? context.theme.textColor
    );
    if (runs.length === 0) {
      this.renderParagraph(context, this.htmlToPlainText(html), options);
      return;
    }

    const fontSize = options?.size ?? 12;
    const indent = options?.indent ?? 0;
    const lineHeight = options?.lineHeight ?? (fontSize === 10 ? 14 : 17);
    const leftX = context.layout.marginLeft + indent;
    const textWidth = Math.max(context.contentWidth - indent * 2, 120);
    const maxX = leftX + textWidth;
    let x = leftX;
    let drewAny = false;

    this.ensureSpace(context, lineHeight + 6);

    const startNewLine = (): void => {
      context.y += lineHeight;
      this.ensureSpace(context, lineHeight);
      x = leftX;
    };

    const drawSegment = (segment: string, run: PdfTextRun): void => {
      const isWhitespace = /^\s+$/.test(segment);
      const fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' =
        run.bold && run.italic ? 'bolditalic' :
        run.bold ? 'bold' :
        run.italic ? 'italic' :
        'normal';

      context.pdf.setFont(context.theme.fontFamily, fontStyle);
      context.pdf.setFontSize(fontSize);
      const width = context.pdf.getTextWidth(segment);

      if (!isWhitespace && run.backgroundColor) {
        this.setFillColor(context, run.backgroundColor);
        context.pdf.rect(x, context.y - lineHeight + 4, width, lineHeight, 'F');
      }

      this.setTextColor(context, run.color || options?.color || context.theme.textColor);
      context.pdf.text(segment, x, context.y);

      if (!isWhitespace && run.underline) {
        this.setStrokeColor(context, run.color || options?.color || context.theme.textColor);
        context.pdf.setLineWidth(0.6);
        context.pdf.line(x, context.y + 1, x + width, context.y + 1);
      }

      x += width;
      drewAny = true;
    };

    for (const run of runs) {
      const lines = run.text.split('\n');
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const parts = line.split(/(\s+)/).filter(part => part.length > 0);

        for (const part of parts) {
          const isWhitespace = /^\s+$/.test(part);
          if (isWhitespace && x === leftX) {
            continue;
          }

          const styleForMeasure: 'normal' | 'bold' | 'italic' | 'bolditalic' =
            run.bold && run.italic ? 'bolditalic' :
            run.bold ? 'bold' :
            run.italic ? 'italic' :
            'normal';
          context.pdf.setFont(context.theme.fontFamily, styleForMeasure);
          context.pdf.setFontSize(fontSize);

          if (isWhitespace) {
            const width = context.pdf.getTextWidth(part);
            if (x + width > maxX) {
              startNewLine();
            } else {
              drawSegment(part, run);
            }
            continue;
          }

          let remaining = part;
          while (remaining.length > 0) {
            const availableWidth = maxX - x;
            const fullWidth = context.pdf.getTextWidth(remaining);

            if (fullWidth <= availableWidth) {
              drawSegment(remaining, run);
              remaining = '';
              break;
            }

            // If we're not at line start, move the token to the next line first.
            if (x > leftX) {
              startNewLine();
              continue;
            }

            // Hard-wrap long unbroken tokens by character width.
            const chunks = context.pdf.splitTextToSize(remaining, textWidth);
            const chunk = (chunks && chunks[0]) ? String(chunks[0]) : remaining.charAt(0);
            drawSegment(chunk, run);
            remaining = remaining.slice(chunk.length);

            if (remaining.length > 0) {
              startNewLine();
            }
          }
        }

        if (lineIndex < lines.length - 1) {
          startNewLine();
          drewAny = true;
        }
      }
    }

    if (drewAny) {
      context.y += lineHeight + 5;
    }
    this.setTextColor(context, context.theme.textColor);
  }

  private async renderImage(context: PdfRenderContext, imageUrl: string, maxImageHeight = 260, indent = 0): Promise<boolean> {
    const imageData = await this.getPdfImageData(imageUrl);
    if (!imageData) {
      return false;
    }

    const maxWidth = Math.max(context.contentWidth - indent * 2, 120);
    const widthRatio = maxWidth / imageData.width;
    const heightRatio = maxImageHeight / imageData.height;
    const scale = Math.min(widthRatio, heightRatio, 1);
    const drawWidth = imageData.width * scale;
    const drawHeight = imageData.height * scale;
    const x = context.layout.marginLeft + indent + (maxWidth - drawWidth) / 2;

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

      const footerY = context.pageHeight - context.layout.marginBottom + 16;
      this.setStrokeColor(context, context.theme.mutedColor);
      context.pdf.setLineWidth(0.6);
      context.pdf.line(
        context.layout.marginLeft,
        context.pageHeight - context.layout.marginBottom,
        context.pageWidth - context.layout.marginRight,
        context.pageHeight - context.layout.marginBottom
      );

      context.pdf.setFont(context.theme.fontFamily, 'normal');
      context.pdf.setFontSize(9);
      this.setTextColor(context, context.theme.mutedColor);
      context.pdf.text(`Page ${page} / ${totalPages}`, context.pageWidth / 2, footerY, { align: 'center' });
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
    // Walk to deepest child route where documentId param is defined.
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
    const candidates = this.buildPdfImageCandidates(imageUrl);
    return new Promise((resolve) => {
      const tryLoad = (index: number): void => {
        if (index >= candidates.length) {
          resolve(null);
          return;
        }

        const candidate = candidates[index];
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.referrerPolicy = 'no-referrer';

        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              tryLoad(index + 1);
              return;
            }

            ctx.drawImage(img, 0, 0);
            const isPng = candidate.startsWith('data:image/png') || candidate.toLowerCase().endsWith('.png');
            const mimeType = isPng ? 'image/png' : 'image/jpeg';
            const dataUrl = canvas.toDataURL(mimeType, 0.9);
            resolve({
              dataUrl,
              width: canvas.width,
              height: canvas.height,
              format: isPng ? 'PNG' : 'JPEG'
            });
          } catch {
            tryLoad(index + 1);
          }
        };

        img.onerror = () => tryLoad(index + 1);
        img.src = candidate;
      };

      tryLoad(0);
    });
  }

  private getPdfImageData(imageUrl: string): Promise<{ dataUrl: string; width: number; height: number; format: 'PNG' | 'JPEG' } | null> {
    const key = (imageUrl || '').trim();
    if (!key) {
      return Promise.resolve(null);
    }

    const cached = this.pdfImagePromiseCache.get(key);
    if (cached) {
      return cached;
    }

    const task = this.loadImageForPdf(key).catch(() => null);
    this.pdfImagePromiseCache.set(key, task);
    return task;
  }

  private async preloadPdfImagesForPages(pages: Page[]): Promise<void> {
    const urls = new Set<string>();

    for (const page of pages) {
      const blocks = Array.isArray(page?.content?.blocks) ? page.content.blocks : [];
      for (const block of blocks) {
        if (block?.type === 'image') {
          const image = this.getImageBlockData(block);
          if (image.url) urls.add(image.url);
          continue;
        }

        if (block?.type === 'gallery') {
          const galleryItems = Array.isArray(block?.content) ? block.content : [];
          for (const item of galleryItems) {
            const itemUrl = typeof item?.url === 'string' ? item.url.trim() : '';
            if (itemUrl) urls.add(itemUrl);
          }
        }
      }
    }

    if (urls.size === 0) {
      return;
    }

    await Promise.all(Array.from(urls).map((url) => this.getPdfImageData(url)));
  }

  private buildPdfImageCandidates(imageUrl: string): string[] {
    const value = (imageUrl || '').trim();
    if (!value) return [];

    const out = [value];
    if (this.isHttpImageUrl(value) && !this.isProxyUrl(value)) {
      out.push(this.toPdfProxyUrl(value));
    }

    return Array.from(new Set(out));
  }

  private isHttpImageUrl(url: string): boolean {
    return /^https?:\/\//i.test(url || '');
  }

  private isProxyUrl(url: string): boolean {
    return /images\.weserv\.nl\/\?url=/i.test(url || '');
  }

  private toPdfProxyUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const stripped = `${parsed.host}${parsed.pathname}${parsed.search}`;
      return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}`;
    } catch {
      return url;
    }
  }

  private htmlToPlainText(input: string, preserveLineBreaks = false): string {
    if (!input) {
      return '';
    }

    // Fast path for plain text values.
    if (!/[<>&]/.test(input)) {
      return input.trim();
    }

    const container = document.createElement('div');
    container.innerHTML = input;

    // Preserve list semantics for PDF output.
    const orderedLists = Array.from(container.querySelectorAll('ol'));
    orderedLists.forEach((ol) => {
      Array.from(ol.querySelectorAll('li')).forEach((li, index) => {
        li.insertBefore(document.createTextNode(`${index + 1}. `), li.firstChild);
        li.appendChild(document.createTextNode('\n'));
      });
    });
    const unorderedLists = Array.from(container.querySelectorAll('ul'));
    unorderedLists.forEach((ul) => {
      Array.from(ul.querySelectorAll('li')).forEach((li) => {
        li.insertBefore(document.createTextNode('• '), li.firstChild);
        li.appendChild(document.createTextNode('\n'));
      });
    });

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

    let text = container.textContent || '';
    text = text.replace(/\u00a0/g, ' ');

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

  private getImageBlockData(block: any): { url: string; caption: string } {
    const content =
      block?.content &&
      typeof block.content === 'object' &&
      !Array.isArray(block.content)
        ? block.content
        : null;
    const urlFromContent = typeof content?.url === 'string' ? content.url : '';
    const captionFromContent =
      typeof content?.caption === 'string' ? content.caption : '';
    const url = typeof block?.imageUrl === 'string' && block.imageUrl
      ? block.imageUrl
      : urlFromContent;
    const caption = typeof block?.imageCaption === 'string'
      ? block.imageCaption
      : captionFromContent;
    return { url, caption };
  }

  private extractStyledRunsFromHtml(
    html: string,
    baseStyle: 'normal' | 'bold' | 'italic',
    baseColor: number[]
  ): PdfTextRun[] {
    const container = document.createElement('div');
    container.innerHTML = this.normalizeExportHtml(html);
    const runs: PdfTextRun[] = [];
    const orderedListIndex = new WeakMap<HTMLElement, number>();

    const walk = (node: Node, state: Omit<PdfTextRun, 'text'>): void => {
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
      const next: Omit<PdfTextRun, 'text'> = {
        ...state,
        color: state.color ? [...state.color] : baseColor
      };

      if (tag === 'strong' || tag === 'b') next.bold = true;
      if (tag === 'em' || tag === 'i') next.italic = true;
      if (tag === 'u') next.underline = true;
      if (tag === 'mark') {
        next.backgroundColor = [254, 243, 205];
      }
      if (tag === 'br') {
        runs.push({ text: '\n', ...next });
        return;
      }

      if (tag === 'ol') {
        if (runs.length > 0 && !runs[runs.length - 1].text.endsWith('\n')) {
          runs.push({ text: '\n', ...next });
        }
        orderedListIndex.set(el, 0);
      }

      if (tag === 'ul') {
        if (runs.length > 0 && !runs[runs.length - 1].text.endsWith('\n')) {
          runs.push({ text: '\n', ...next });
        }
      }

      if (tag === 'li') {
        if (runs.length > 0 && !runs[runs.length - 1].text.endsWith('\n')) {
          runs.push({ text: '\n', ...next });
        }
        const parent = el.parentElement;
        if (parent && parent.tagName.toLowerCase() === 'ol') {
          const index = (orderedListIndex.get(parent) ?? 0) + 1;
          orderedListIndex.set(parent, index);
          runs.push({ text: `${index}. `, ...next });
        } else {
          runs.push({ text: '• ', ...next });
        }
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

      // Fallback to computed styles so pasted/class-based colors are preserved in export.
      const computedStyle = window.getComputedStyle(el);
      if (!next.color && computedStyle?.color) {
        const computedColor = this.parseCssColor(computedStyle.color);
        if (computedColor) {
          next.color = computedColor;
        }
      }
      if (!next.backgroundColor && computedStyle?.backgroundColor) {
        const computedBg = this.parseCssColor(computedStyle.backgroundColor);
        if (computedBg) {
          next.backgroundColor = computedBg;
        }
      }

      const isBlock = ['div', 'p', 'li', 'ul', 'ol', 'blockquote', 'pre', 'h1', 'h2', 'h3'].includes(tag);
      if (isBlock && tag !== 'li' && runs.length > 0 && !runs[runs.length - 1].text.endsWith('\n')) {
        runs.push({ text: '\n', ...next });
      }

      el.childNodes.forEach((child) => walk(child, next));

      if (isBlock && runs.length > 0 && !runs[runs.length - 1].text.endsWith('\n')) {
        runs.push({ text: '\n', ...next });
      }
    };

    const initial: Omit<PdfTextRun, 'text'> = {
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

    // Named colors and browser-normalized CSS values fallback.
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
    const container = document.createElement('div');
    container.innerHTML = input;

    container.querySelectorAll('*').forEach((el) => {
      // Remove editor/runtime attributes but preserve inline style/color markup.
      el.removeAttribute('contenteditable');
      el.removeAttribute('data-placeholder');
      el.removeAttribute('data-empty');
      el.removeAttribute('ng-reflect-ng-if');

      if (el.classList.contains('ng-star-inserted')) {
        el.classList.remove('ng-star-inserted');
      }
      if (!el.className || !el.className.trim()) {
        el.removeAttribute('class');
      }
    });

    return container.innerHTML;
  }

  private getSafeFilename(input: string): string {
    return input
      .trim()
      .replace(/[<>:"/\\|?*]+/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 100) || 'document';
  }
}
