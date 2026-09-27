import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage, isHandledGlobally, isNonApiResponse } from './http-errors';

const htmlInsteadOfJson = new HttpErrorResponse({
  status: 200,
  error: { error: new SyntaxError(`Unexpected token '<', "<!doctype "... is not valid JSON`), text: '<!doctype html>' },
});

describe('http-errors', () => {
  it('recognises a 2xx response whose body could not be parsed', () => {
    expect(isNonApiResponse(htmlInsteadOfJson)).toBe(true);
    expect(isHandledGlobally(htmlInsteadOfJson)).toBe(true);
  });

  it('never returns the parser message', () => {
    expect(apiErrorMessage(htmlInsteadOfJson, 'No se pudieron cargar las notas.')).toBe('No se pudieron cargar las notas.');
  });

  it('returns the backend message for a business error', () => {
    const notFound = new HttpErrorResponse({ status: 404, error: { error: { message: 'Nota no encontrada.' } } });
    expect(isNonApiResponse(notFound)).toBe(false);
    expect(isHandledGlobally(notFound)).toBe(false);
    expect(apiErrorMessage(notFound, 'x')).toBe('Nota no encontrada.');
  });

  it('falls back when the error body is not an API result', () => {
    const htmlError = new HttpErrorResponse({ status: 405, error: '<html>Not Allowed</html>' });
    expect(apiErrorMessage(htmlError, 'fallback')).toBe('fallback');
  });
});
