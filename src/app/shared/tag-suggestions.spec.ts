import { signal } from '@angular/core';
import { tagSuggestions } from './tag-suggestions';

describe('tagSuggestions', () => {
  it('filters by what is typed, ignoring case and accents, and hides chosen tags', () => {
    const chosen = signal<string[]>(['docker']);
    const tags = tagSuggestions(signal(['compositor', 'docker', 'Diseño', 'fix']), chosen);

    expect(tags.suggestions()).toEqual(['compositor', 'Diseño', 'fix']);

    tags.onInput({ target: { value: 'DISE' } } as unknown as Event);
    expect(tags.suggestions()).toEqual(['Diseño']);

    tags.onInput({ target: { value: 'do' } } as unknown as Event);
    expect(tags.suggestions()).toEqual([]);

    chosen.set([]);
    expect(tags.suggestions()).toEqual(['docker']);
  });
});
