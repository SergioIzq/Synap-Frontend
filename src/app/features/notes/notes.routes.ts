import { Routes } from '@angular/router';

export const NOTES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/notes-list.page').then((m) => m.NotesListPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/note-detail.page').then((m) => m.NoteDetailPage),
  },
];
