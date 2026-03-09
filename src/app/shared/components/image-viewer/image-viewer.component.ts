import { Component, Inject, HostListener } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ImageViewerData {
  imageUrl: string;
  caption?: string;
}

@Component({
  selector: 'app-image-viewer',
  templateUrl: './image-viewer.component.html',
  styleUrls: ['./image-viewer.component.css']
})
export class ImageViewerComponent {
  
  constructor(
    public dialogRef: MatDialogRef<ImageViewerComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ImageViewerData
  ) {}

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    // Keyboard shortcuts: ESC closes, D triggers quick download.
    if (event.key === 'Escape') {
      this.close();
    }
    if (event.key === 'd' || event.key === 'D') {
      this.downloadImage();
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  downloadImage(): void {
    // Browser-native download via temporary anchor.
    const link = document.createElement('a');
    link.href = this.data.imageUrl;
    link.download = 'image.jpg';
    link.click();
  }
}
