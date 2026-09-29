import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { MemoryService } from '../../../core/services/api/memory.service';
import { NotificationService } from '../../../core/services/notification.service';
import { MemoryEntry } from '../../../core/models';
import { formatDateTime } from '../../../core/utils/dates';
import { apiErrorMessage, isHandledGlobally } from '../../../core/utils/http-errors';

/** Used until the list arrives with the server's own limits. */
const DEFAULT_MAX_ENTRIES = 25;
const DEFAULT_MAX_TEXT = 200;

/**
 * Settings > Memoria: what the assistant knows about the user (specs/assistant-memory
 * "Manage memory from the web app"). Rendered whether or not a Groq key is configured.
 */
@Component({
  selector: 'app-memory-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ButtonModule, InputTextModule, SkeletonModule],
  styles: [`
    .add-form {
      display: flex;
      gap: 0.5rem;
      align-items: flex-start;

      .text-field { flex: 1; min-width: 0; }
      input { width: 100%; }
    }

    .char-count {
      display: block;
      margin-top: 0.25rem;
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
      text-align: right;
    }

    .entries {
      list-style: none;
      margin: 1rem 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .entry {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.6rem 0.75rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-border-radius, 6px);
      background: var(--synap-page-bg);

      .entry-body { flex: 1; min-width: 0; }
      .entry-text { margin: 0; font-size: 0.9rem; line-height: 1.45; overflow-wrap: anywhere; }
      .entry-date { display: block; margin-top: 0.2rem; font-size: 0.75rem; color: var(--p-text-muted-color); }
      .entry-buttons { display: flex; flex-shrink: 0; }
      input { width: 100%; }
    }

    .edit-buttons { display: flex; gap: 0.25rem; margin-top: 0.4rem; justify-content: flex-end; }

    .usage { margin: 0 0 0.75rem; font-size: 0.8rem; color: var(--p-text-muted-color); }

    .empty { margin: 1rem 0 0; font-size: 0.875rem; color: var(--p-text-muted-color); }

    .footer { display: flex; justify-content: flex-end; margin-top: 1rem; }
  `],
  template: `
    @if (loading() && !loaded()) {
      <p-skeleton height="2.5rem" styleClass="mb-2" />
      <p-skeleton height="3.5rem" />
    } @else {
      <p class="usage">{{ entries().length }}/{{ maxEntries() }} recuerdos</p>
      <form class="add-form" (submit)="$event.preventDefault(); add()">
        <div class="text-field">
          <input
            pInputText
            [value]="newText()"
            (input)="newText.set($any($event.target).value)"
            [attr.maxlength]="maxText()"
            [disabled]="full()"
            [placeholder]="full() ? 'Memoria llena: borra un recuerdo para añadir otro' : 'Ej.: Trabajo con .NET y Angular'"
            aria-label="Nuevo recuerdo"
          />
          <small class="char-count">{{ newText().length }}/{{ maxText() }}</small>
        </div>
        <p-button type="submit" icon="pi pi-plus" label="Añadir" [disabled]="!newText().trim() || full() || busy()" />
      </form>

      @if (entries().length === 0) {
        <p class="empty">Aún no hay nada. Añade algo aquí o pídele al asistente que lo recuerde.</p>
      } @else {
        <ul class="entries">
          @for (entry of entries(); track entry.id) {
            <li class="entry">
              <div class="entry-body">
                @if (editingId() === entry.id) {
                  <input
                    pInputText
                    [value]="editText()"
                    (input)="editText.set($any($event.target).value)"
                    (keydown.enter)="$event.preventDefault(); saveEdit(entry)"
                    (keydown.escape)="cancelEdit()"
                    [attr.maxlength]="maxText()"
                    aria-label="Editar recuerdo"
                  />
                  <small class="char-count">{{ editText().length }}/{{ maxText() }}</small>
                  <div class="edit-buttons">
                    <p-button label="Cancelar" size="small" severity="secondary" [text]="true" (onClick)="cancelEdit()" />
                    <p-button label="Guardar" icon="pi pi-check" size="small" [disabled]="!editText().trim() || busy()" (onClick)="saveEdit(entry)" />
                  </div>
                } @else {
                  <p class="entry-text">{{ entry.text }}</p>
                  <small class="entry-date">Actualizado el {{ formatDate(entry.updatedAt) }}</small>
                }
              </div>
              @if (editingId() !== entry.id) {
                <div class="entry-buttons">
                  <p-button icon="pi pi-pencil" size="small" severity="secondary" [text]="true" [rounded]="true" ariaLabel="Editar recuerdo" [disabled]="busy()" (onClick)="startEdit(entry)" />
                  <p-button icon="pi pi-trash" size="small" severity="danger" [text]="true" [rounded]="true" ariaLabel="Borrar recuerdo" [disabled]="busy()" (onClick)="remove(entry)" />
                </div>
              }
            </li>
          }
        </ul>
        <div class="footer">
          <p-button label="Borrar toda la memoria" icon="pi pi-trash" size="small" severity="danger" [text]="true" [disabled]="busy()" (onClick)="confirmDeleteAll()" />
        </div>
      }
    }
  `,
})
export class MemorySettingsComponent implements OnInit {
  private readonly memoryService = inject(MemoryService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly notifications = inject(NotificationService);

  protected readonly entries = signal<MemoryEntry[]>([]);
  protected readonly maxEntries = signal(DEFAULT_MAX_ENTRIES);
  protected readonly maxText = signal(DEFAULT_MAX_TEXT);
  protected readonly loading = signal(false);
  protected readonly loaded = signal(false);
  protected readonly busy = signal(false);

  protected readonly newText = signal('');
  protected readonly editingId = signal<string | null>(null);
  protected readonly editText = signal('');

  protected readonly full = computed(() => this.entries().length >= this.maxEntries());

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await firstValueFrom(this.memoryService.list());
      this.entries.set(list.entries);
      this.maxEntries.set(list.maxEntries);
      this.maxText.set(list.maxTextLength);
      this.loaded.set(true);
    } catch (err) {
      this.reportError(err, 'No se pudo cargar la memoria.');
    } finally {
      this.loading.set(false);
    }
  }

  async add(): Promise<void> {
    const text = this.newText().trim();
    if (!text || this.full()) return;

    await this.run(async () => {
      const entry = await firstValueFrom(this.memoryService.add(text));
      this.entries.update((entries) => [entry, ...entries]);
      this.newText.set('');
    }, 'No se pudo guardar el recuerdo.');
  }

  protected startEdit(entry: MemoryEntry): void {
    this.editingId.set(entry.id);
    this.editText.set(entry.text);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  async saveEdit(entry: MemoryEntry): Promise<void> {
    const text = this.editText().trim();
    if (!text) return;
    if (text === entry.text) {
      this.cancelEdit();
      return;
    }

    await this.run(async () => {
      const updated = await firstValueFrom(this.memoryService.update(entry.id, text));
      // Most recently updated first, like the server's order.
      this.entries.update((entries) => [updated, ...entries.filter((e) => e.id !== entry.id)]);
      this.editingId.set(null);
    }, 'No se pudo guardar el recuerdo.');
  }

  async remove(entry: MemoryEntry): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.memoryService.delete(entry.id));
      this.entries.update((entries) => entries.filter((e) => e.id !== entry.id));
    }, 'No se pudo borrar el recuerdo.');
  }

  protected confirmDeleteAll(): void {
    this.confirmationService.confirm({
      header: 'Borrar toda la memoria',
      message: 'El asistente olvidará todo lo que sabe de ti. ¿Continuar?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Borrar todo',
      rejectLabel: 'Cancelar',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => void this.deleteAll(),
    });
  }

  private async deleteAll(): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.memoryService.deleteAll());
      this.entries.set([]);
      this.editingId.set(null);
      this.notifications.success('Memoria borrada');
    }, 'No se pudo borrar la memoria.');
  }

  protected formatDate(value: string): string {
    return formatDateTime(value);
  }

  private async run(action: () => Promise<void>, fallback: string): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (err) {
      this.reportError(err, fallback);
    } finally {
      this.busy.set(false);
    }
  }

  /** Network and 5xx failures are already announced by errorInterceptor. */
  private reportError(err: unknown, fallback: string): void {
    if (!isHandledGlobally(err)) {
      this.notifications.error('Error', apiErrorMessage(err, fallback));
    }
  }
}
