#!/usr/bin/env node
// Generates every app icon from the Synap logo (the same mark as the sidebar) - run after
// changing the logo:   node scripts/generate-icons.mjs
//
// Renders with a local Chrome/Chromium over the DevTools protocol (no image libraries added to
// the project). Set CHROME=/path/to/chrome if it isn't `google-chrome` on your PATH.
//
// Outputs (in public/):
//   favicon.svg                 modern browsers (scales to any size, sharp on HiDPI)
//   favicon.ico / favicon-32.png legacy /favicon.ico requests and PNG fallback
//   apple-touch-icon.png (180)  iOS home screen - opaque and full-bleed (iOS rounds it itself)
//   icons/icon-<n>.png          manifest, purpose "any" (rounded square)
//   icons/maskable-<n>.png      manifest, purpose "maskable" (full-bleed, logo inside the safe zone)

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const CHROME = process.env.CHROME ?? 'google-chrome';
const PORT = 9555;

// The sidebar logo, drawn in a 32-unit box: three nodes joined to a central one.
const LOGO = `
  <g stroke="#ffffff" stroke-opacity="0.45" stroke-width="1.75" stroke-linecap="round">
    <line x1="16" y1="16" x2="16" y2="6"/>
    <line x1="16" y1="16" x2="24.66" y2="21"/>
    <line x1="16" y1="16" x2="7.34" y2="21"/>
  </g>
  <g fill="#ffffff">
    <circle cx="16" cy="6" r="2.5" fill-opacity="0.8"/>
    <circle cx="24.66" cy="21" r="2.5" fill-opacity="0.8"/>
    <circle cx="7.34" cy="21" r="2.5" fill-opacity="0.8"/>
    <circle cx="16" cy="16" r="5"/>
  </g>`;

// The mark's visual centre is (16, 13.5) - it reaches higher above the hub than below it.
function icon({ rounded, scale }) {
  const tx = 256 - 16 * scale;
  const ty = 256 - 13.5 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1e1b4b"/>
      <stop offset="1" stop-color="#4f46e5"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#bg)"/>
  <g transform="translate(${tx} ${ty}) scale(${scale})">${LOGO}
  </g>
</svg>
`;
}

const ANY = icon({ rounded: true, scale: 14 });
// Maskable: launchers crop to a circle/squircle - keep the mark well inside the 80% safe zone.
const MASKABLE = icon({ rounded: false, scale: 11 });

const outputs = [
  ...[72, 96, 128, 144, 152, 192, 384, 512].map((size) => ({ file: `icons/icon-${size}x${size}.png`, svg: ANY, size })),
  ...[192, 512].map((size) => ({ file: `icons/maskable-${size}x${size}.png`, svg: MASKABLE, size })),
  { file: 'apple-touch-icon.png', svg: MASKABLE, size: 180 },
  { file: 'favicon-32.png', svg: ANY, size: 32 },
  { file: 'favicon-16.png', svg: ANY, size: 16, temporary: true },
];

async function main() {
  mkdirSync(join(PUBLIC_DIR, 'icons'), { recursive: true });
  writeFileSync(join(PUBLIC_DIR, 'favicon.svg'), ANY);

  const profile = mkdtempSync(join(tmpdir(), 'synap-icons-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], {
    stdio: 'ignore',
  });

  try {
    const cdp = await connect();
    const pngs = {};
    for (const output of outputs) {
      pngs[output.file] = await render(cdp, output.svg, output.size);
      if (!output.temporary) writeFileSync(join(PUBLIC_DIR, output.file), pngs[output.file]);
      console.log(`${output.temporary ? '(tmp) ' : ''}${output.file}`);
    }
    writeFileSync(join(PUBLIC_DIR, 'favicon.ico'), ico([pngs['favicon-16.png'], pngs['favicon-32.png']], [16, 32]));
    console.log('favicon.ico');
    cdp.close();
  } finally {
    chrome.kill();
    rmSync(profile, { recursive: true, force: true });
  }
}

async function connect() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return open(page.webSocketDebuggerUrl);
    } catch {
      // Chrome still starting.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Could not reach Chrome (${CHROME}) on port ${PORT}`);
}

async function open(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const messageId = ++id;
      pending.set(messageId, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
      ws.send(JSON.stringify({ id: messageId, method, params }));
    });
  await send('Page.enable');
  return { send, close: () => ws.close() };
}

async function render(cdp, svg, size) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  const html = `<html><body style="margin:0;background:transparent"><img width="${size}" height="${size}" style="display:block" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`;
  await cdp.send('Page.navigate', { url: `data:text/html;base64,${Buffer.from(html).toString('base64')}` });
  await new Promise((r) => setTimeout(r, 300));
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: size, height: size, scale: 1 },
    captureBeyondViewport: false,
  });
  return Buffer.from(data, 'base64');
}

// .ico container holding PNG images (supported by every browser that still asks for it).
function ico(images, sizes) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((png, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(sizes[i] % 256, entry);
    header.writeUInt8(sizes[i] % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
