import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { Note, NoteType } from '../../../core/models';
import { formatDateTime } from '../../../core/utils/dates';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';

const TYPE_META: Record<NoteType, { icon: string; label: string }> = {
  text: { icon: 'pi pi-align-left', label: 'Texto' },
  codeSnippet: { icon: 'pi pi-code', label: 'Código' },
  bookmark: { icon: 'pi pi-link', label: 'Enlace' },
};

/** specs/web-experience "Note summaries show type and age". */
@Component({
  selector: 'app-note-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterLink, TagModule, RelativeTimePipe],
  styles: [`
    a {
      display: block;
      margin-bottom: 0.75rem;
      padding: 0.9rem 1rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-border-radius-lg, 10px);
      background: var(--p-content-background);
      color: inherit;
      text-decoration: none;
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;

      &:hover, &:focus-visible {
        transform: translateY(-2px);
        box-shadow: var(--synap-card-hover-shadow);
        border-color: color-mix(in srgb, var(--p-primary-color) 35%, var(--p-content-border-color));
      }
    }

    .meta {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      margin-bottom: 0.4rem;
      font-size: 0.75rem;
      color: var(--p-text-muted-color);

      .type { display: inline-flex; align-items: center; gap: 0.3rem; color: var(--p-primary-color); font-weight: 600; }
      .age { margin-left: auto; white-space: nowrap; }
    }

    .title { font-weight: 650; margin: 0 0 0.25rem; line-height: 1.35; }
    .preview { margin: 0; color: var(--p-text-muted-color); font-size: 0.9rem; line-height: 1.5; overflow-wrap: anywhere; }

    .code {
      margin: 0;
      padding: 0.55rem 0.7rem;
      max-height: 5.2rem;
      overflow: hidden;
      white-space: pre-wrap;
      font-family: var(--synap-font-mono, monospace);
      font-size: 0.8rem;
      background: var(--synap-code-bg);
      border-radius: 6px;
    }

    .bookmark {
      display: flex;
      gap: 0.9rem;
      align-items: flex-start;

      .text { flex: 1; min-width: 0; }
      .domain { font-size: 0.75rem; color: var(--p-primary-color); overflow-wrap: anywhere; }
      img { width: 88px; height: 64px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
    }

    .tags { margin-top: 0.6rem; display: flex; gap: 0.35rem; flex-wrap: wrap; }
  `],
  template: `
    <a [routerLink]="['/app/notes', note.id]" [attr.aria-label]="typeMeta.label + ': ' + heading()">
      <div class="meta">
        <span class="type"><i [class]="typeMeta.icon"></i>{{ typeMeta.label }}</span>
        <span class="age" [title]="fullDate()">{{ note.createdAt | relativeTime }}</span>
      </div>

      @switch (note.type) {
        @case ('bookmark') {
          <div class="bookmark">
            <div class="text">
              <div class="domain">{{ domain() }}</div>
              <p class="title">{{ note.metadataTitle ?? note.title ?? note.content }}</p>
              @if (note.metadataDescription) {
                <p class="preview">{{ preview(note.metadataDescription, 160) }}</p>
              }
            </div>
            @if (note.metadataImageUrl) {
              <img [src]="note.metadataImageUrl" alt="" loading="lazy" />
            }
          </div>
        }
        @case ('codeSnippet') {
          @if (note.title) {
            <p class="title">{{ note.title }}</p>
          }
          <pre class="code">{{ preview(note.content, 300) }}</pre>
        }
        @default {
          @if (note.title) {
            <p class="title">{{ note.title }}</p>
          }
          <p class="preview">{{ preview(plainText(note.content), 220) }}</p>
        }
      }

      @if (note.tags.length > 0) {
        <div class="tags">
          @for (tag of note.tags; track tag) {
            <p-tag [value]="'#' + tag" severity="secondary" />
          }
        </div>
      }
    </a>
  `,
})
export class NoteCardComponent {
  @Input({ required: true }) note!: Note;

  protected get typeMeta() {
    return TYPE_META[this.note.type] ?? TYPE_META.text;
  }

  protected heading(): string {
    return this.note.title ?? this.note.metadataTitle ?? this.preview(this.note.content, 60);
  }

  protected domain(): string {
    try {
      return new URL(this.note.content.trim()).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  protected fullDate(): string {
    return formatDateTime(this.note.createdAt);
  }

  /** Markdown markers out of a one-paragraph preview; the detail page renders the real thing. */
  protected plainText(markdown: string): string {
    return markdown
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
      .replace(/(\*\*|__|\*|_|~~|`)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  protected preview(content: string, max: number): string {
    return content.length > max ? content.slice(0, max).trimEnd() + '…' : content;
  }
}
