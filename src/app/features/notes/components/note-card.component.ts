import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { Note } from '../../../core/models';

@Component({
  selector: 'app-note-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterLink, CardModule, TagModule],
  styles: [`
    a {
      display: block;
      text-decoration: none;
      color: inherit;
      margin-bottom: 0.75rem;
      transition: transform 0.18s ease, box-shadow 0.18s ease;

      &:hover {
        transform: translateY(-2px);

        ::ng-deep .p-card {
          box-shadow: var(--synap-card-hover-shadow);
        }
      }
    }

    .note-image {
      max-width: 100%;
      max-height: 140px;
      object-fit: cover;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }

    .note-code {
      white-space: pre-wrap;
      font-family: monospace;
      font-size: 0.85rem;
      max-height: 4.5rem;
      overflow: hidden;
      background: var(--synap-code-bg);
      border-radius: 4px;
      padding: 0.5rem;
    }

    .note-title {
      font-weight: 600;
      margin: 0 0 0.25rem;
    }

    .note-preview {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 0.9rem;
    }

    .note-tags {
      margin-top: 0.5rem;
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
  `],
  template: `
    <a [routerLink]="['/app/notes', note.id]">
      <p-card>
        @switch (note.type) {
          @case ('bookmark') {
            @if (note.metadataImageUrl) {
              <img [src]="note.metadataImageUrl" alt="" class="note-image" />
            }
            <p class="note-title">{{ note.metadataTitle ?? note.content }}</p>
            @if (note.metadataDescription) {
              <p class="note-preview">{{ note.metadataDescription }}</p>
            }
            <small>{{ note.content }}</small>
          }
          @case ('codeSnippet') {
            @if (note.title) {
              <p class="note-title">{{ note.title }}</p>
            }
            <pre class="note-code">{{ preview(note.content) }}</pre>
          }
          @default {
            @if (note.title) {
              <p class="note-title">{{ note.title }}</p>
            }
            <p class="note-preview">{{ preview(note.content) }}</p>
          }
        }

        @if (note.tags.length > 0) {
          <div class="note-tags">
            @for (tag of note.tags; track tag) {
              <p-tag [value]="'#' + tag" severity="secondary" />
            }
          </div>
        }
      </p-card>
    </a>
  `,
})
export class NoteCardComponent {
  @Input({ required: true }) note!: Note;

  preview(content: string): string {
    return content.length > 200 ? content.slice(0, 200) + '…' : content;
  }
}
