import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppShellComponent } from './layout/app-shell/app-shell.component';
import { DocumentListComponent } from './features/document/document-list/document-list.component';
import { DocumentEditorComponent } from './features/document/document-editor/document-editor.component';
import { ProjectComponent } from './features/project/project.component';

const routes: Routes = [
  {
    // App shell hosts persistent layout; feature pages render as children.
    path: '',
    component: AppShellComponent,
    children: [
      { path: '', redirectTo: '/documents', pathMatch: 'full' },
      { path: 'documents', component: DocumentListComponent },
      { path: 'project/:projectId', component: ProjectComponent },
      { path: 'document/:documentId', component: DocumentEditorComponent },
      { path: '**', redirectTo: '/documents' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
