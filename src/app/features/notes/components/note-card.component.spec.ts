import { NoteCardComponent } from './note-card.component';

describe('NoteCardComponent preview', () => {
  const card = new NoteCardComponent() as unknown as { plainText(md: string): string };

  it('strips markdown markers but keeps the words', () => {
    expect(card.plainText('Para arreglar el **CORS** reinicié con `LocalhostPolicy`.')).toBe(
      'Para arreglar el CORS reinicié con LocalhostPolicy.',
    );
    expect(card.plainText('# Título\n- punto uno\n> cita [enlace](https://x.io)')).toBe('Título punto uno cita enlace');
  });
});
