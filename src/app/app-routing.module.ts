import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppShellComponent } from './layout/app-shell/app-shell.component';
import { DocumentListComponent } from './features/document/document-list/document-list.component';
import { DocumentEditorComponent } from './features/document/document-editor/document-editor.component';

const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      { path: '', redirectTo: '/documents', pathMatch: 'full' },
      { path: 'documents', component: DocumentListComponent },
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