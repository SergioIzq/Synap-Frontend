import { Injectable, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
// highlight.js's top-level package bundles every language (~1MB+); importing the core and
// registering a handful of common ones keeps the note-detail page's lazy chunk small.
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import csharp from 'highlight.js/lib/languages/csharp';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('yaml', yaml);

@Injectable({ providedIn: 'root' })
export class MarkdownService {
  private readonly sanitizer = inject(DomSanitizer);

  toSafeHtml(markdown: string): SafeHtml {
    const html = marked.parse(markdown, { async: false }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  highlightCode(code: string): SafeHtml {
    const highlighted = hljs.highlightAuto(code).value;
    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }
}
