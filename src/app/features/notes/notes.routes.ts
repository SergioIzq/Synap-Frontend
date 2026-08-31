import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const NOTES_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/notes-list.page').then((m) => m.NotesListPage),
  },
  {
    path: ':id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/note-detail.page').then((m) => m.NoteDetailPage),
  },
];
