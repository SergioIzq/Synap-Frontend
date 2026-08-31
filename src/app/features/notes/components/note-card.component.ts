import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Note } from '../../../core/models';

@Component({
  selector: 'app-note-card',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a class="note-card" [routerLink]="['/notes', note.id]">
      @switch (note.type) {
        @case ('bookmark') {
          @if (note.metadataImageUrl) {
            <img [src]="note.metadataImageUrl" alt="" class="note-card__image" />
          }
          <strong>{{ note.metadataTitle ?? note.content }}</strong>
          @if (note.metadataDescription) {
            <p>{{ note.metadataDescription }}</p>
          }
          <small>{{ note.content }}</small>
        }
        @case ('codeSnippet') {
          @if (note.title) {
            <strong>{{ note.title }}</strong>
          }
          <pre class="note-card__code">{{ preview(note.content) }}</pre>
        }
        @default {
          @if (note.title) {
            <strong>{{ note.title }}</strong>
          }
          <p>{{ preview(note.content) }}</p>
        }
      }

      @if (note.tags.length > 0) {
        <div class="note-card__tags">
          @for (tag of note.tags; track tag) {
            <span class="tag-chip">#{{ tag }}</span>
          }
        </div>
      }
    </a>
  `,
  styles: `
    .note-card {
      display: block;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      margin-bottom: 0.75rem;
      text-decoration: none;
      color: inherit;
    }
    .note-card__image {
      max-width: 100%;
      max-height: 160px;
      object-fit: cover;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }
    .note-card__code {
      white-space: pre-wrap;
      font-family: monospace;
      font-size: 0.85rem;
      max-height: 4.5rem;
      overflow: hidden;
    }
    .note-card__tags {
      margin-top: 0.5rem;
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
    .tag-chip {
      font-size: 0.75rem;
      background: #eee;
      border-radius: 999px;
      padding: 0.1rem 0.6rem;
    }
  `,
})
export class NoteCardComponent {
  @Input({ required: true }) note!: Note;

  preview(content: string): string {
    return content.length > 200 ? content.slice(0, 200) + '…' : content;
  }
}
