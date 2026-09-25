import { Signal, computed, signal } from '@angular/core';

/**
 * Suggestions for a p-inputtags field: PrimeNG shows whatever list it's given, so this narrows
 * it to tags containing what's being typed (case/accent-insensitive) and drops ones already
 * chosen. Feed `onInput` from the field's (input) event and `chosen` from the form control.
 */
export function tagSuggestions(allTags: Signal<string[]>, chosen: Signal<string[]>) {
  const query = signal('');

  const suggestions = computed(() => {
    const q = normalize(query());
    const taken = new Set(chosen().map(normalize));
    return allTags()
      .filter((tag) => !taken.has(normalize(tag)) && (!q || normalize(tag).includes(q)))
      .slice(0, 8);
  });

  return {
    suggestions,
    onInput: (event: Event) => query.set((event.target as HTMLInputElement | null)?.value ?? ''),
    reset: () => query.set(''),
  };
}

function normalize(value: string): string {
  return value.trim().replace(/^#/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
