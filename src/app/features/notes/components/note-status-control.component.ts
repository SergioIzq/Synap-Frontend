import { ChangeDetectionStrategy, Component, Input, ViewChild, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Menu, MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { NOTE_STATUSES, NOTE_STATUS_LABELS, Note, NoteStatus } from '../../../core/models';
import { NotesStore } from '../store/notes.store';

/**
 * How each status reads. A note with no status shows nothing at all - it is material, not work
 * (note-status design.md Decision 1).
 */
const STATUS_META: Record<NoteStatus, { icon: string; severity: 'info' | 'warn' | 'secondary' | 'success' }> = {
  pending: { icon: 'pi pi-inbox', severity: 'info' },
  inProgress: { icon: 'pi pi-hammer', severity: 'warn' },
  paused: { icon: 'pi pi-pause', severity: 'secondary' },
  completed: { icon: 'pi pi-check', severity: 'success' },
};

/**
 * The status badge and the menu that changes or clears it - the same control on a list card and on
 * the note's own page (specs/web-experience "The notes list shows and changes a note's status").
 */
@Component({
  selector: 'app-note-status-control',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ButtonModule, MenuModule, TagModule],
  styles: [`
    :host { display: inline-flex; align-items: center; gap: 0.3rem; }
    .badge ::ng-deep .p-tag { font-size: 0.7rem; padding: 0.05rem 0.35rem; }
    .trigger ::ng-deep .p-button { width: 1.6rem; height: 1.6rem; }
  `],
  template: `
    @if (note.status; as status) {
      <span class="badge">
        <p-tag [value]="label(status)" [icon]="meta(status).icon" [severity]="meta(status).severity" />
      </span>
    }
    <span class="trigger">
      <p-button
        icon="pi pi-ellipsis-h"
        severity="secondary"
        [text]="true"
        size="small"
        [rounded]="true"
        [loading]="saving()"
        [attr.aria-label]="'Cambiar el estado de ' + heading"
        (onClick)="statusMenu.toggle($event)"
      />
      <p-menu #statusMenu [model]="items()" [popup]="true" appendTo="body" />
    </span>
  `,
})
export class NoteStatusControlComponent {
  @Input({ required: true }) note!: Note;
  /** Names the note in the control's accessible label. */
  @Input() heading = 'la nota';

  private readonly notesStore = inject(NotesStore);

  @ViewChild('statusMenu') private statusMenuRef?: Menu;

  protected readonly saving = signal(false);

  protected label(status: NoteStatus): string {
    return NOTE_STATUS_LABELS[status];
  }

  protected meta(status: NoteStatus) {
    return STATUS_META[status];
  }

  /** The four statuses, plus clearing it when the note carries one. */
  protected items(): MenuItem[] {
    const items: MenuItem[] = NOTE_STATUSES.map((status) => ({
      label: NOTE_STATUS_LABELS[status],
      icon: STATUS_META[status].icon,
      disabled: this.note.status === status,
      command: () => void this.setStatus(status),
    }));
    if (this.note.status) {
      items.push({ separator: true }, { label: 'Sin estado', icon: 'pi pi-times', command: () => void this.setStatus(null) });
    }
    return items;
  }

  /** The store saves it, re-reads the note and shows the Spanish toast; the badge updates in place. */
  protected async setStatus(status: NoteStatus | null): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.notesStore.setStatus(this.note.id, status);
    } catch {
      // The store already reported it.
    } finally {
      this.saving.set(false);
      this.statusMenuRef?.hide();
    }
  }
}
