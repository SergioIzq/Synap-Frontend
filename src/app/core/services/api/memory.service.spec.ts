import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { MemoryService } from './memory.service';

const ENTRY = { id: 'm1', text: 'Trabajo con .NET y Angular', updatedAt: '2026-09-28T10:00:00' };

describe('MemoryService', () => {
  let service: MemoryService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/memory`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MemoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() unwraps the entries and limits', async () => {
    const promise = firstValueFrom(service.list());
    http.expectOne({ method: 'GET', url: base }).flush({ value: { entries: [ENTRY], maxEntries: 25, maxTextLength: 200 } });
    expect(await promise).toEqual({ entries: [ENTRY], maxEntries: 25, maxTextLength: 200 });
  });

  it('add() posts the text', async () => {
    const promise = firstValueFrom(service.add('Trabajo con .NET y Angular'));
    const req = http.expectOne({ method: 'POST', url: base });
    expect(req.request.body).toEqual({ text: 'Trabajo con .NET y Angular' });
    req.flush({ value: ENTRY });
    expect(await promise).toEqual(ENTRY);
  });

  it('update() puts the new text on the entry', async () => {
    const promise = firstValueFrom(service.update('m1', 'nuevo'));
    const req = http.expectOne({ method: 'PUT', url: `${base}/m1` });
    expect(req.request.body).toEqual({ text: 'nuevo' });
    req.flush({ value: { ...ENTRY, text: 'nuevo' } });
    expect((await promise).text).toBe('nuevo');
  });

  it('delete() and deleteAll() issue DELETEs', async () => {
    const one = firstValueFrom(service.delete('m1'));
    http.expectOne({ method: 'DELETE', url: `${base}/m1` }).flush({});
    await one;

    const all = firstValueFrom(service.deleteAll());
    http.expectOne({ method: 'DELETE', url: base }).flush({});
    await all;
  });
});
