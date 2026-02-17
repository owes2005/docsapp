import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// Material Modules
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { MatBadgeModule } from '@angular/material/badge';
import { DragDropModule } from '@angular/cdk/drag-drop';

// Routing
import { AppRoutingModule } from './app-routing.module';

// Root Component
import { AppComponent } from './app.component';

// Layout Components
import { AppShellComponent } from './layout/app-shell/app-shell.component';
import { MainSidebarComponent } from './layout/main-sidebar/main-sidebar.component';

// Feature Components
import { DocumentListComponent } from './features/document/document-list/document-list.component';
import { DocumentEditorComponent } from './features/document/document-editor/document-editor.component';
import { BlockEditorComponent } from './features/canvas/block-editor/block-editor.component';

// Shared Components
import { TextToolbarComponent } from './shared/components/text-toolbar/text-toolbar.component';
import { ImageViewerComponent } from './shared/components/image-viewer/image-viewer.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';

@NgModule({
  declarations: [
    AppComponent,
    AppShellComponent,
    MainSidebarComponent,
    DocumentListComponent,
    DocumentEditorComponent,
    BlockEditorComponent,
    TextToolbarComponent,
    ImageViewerComponent,
    DashboardComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    AppRoutingModule,
    
    // Material Modules
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatListModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
    MatDialogModule,
    MatBadgeModule,
    DragDropModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
