import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The Synap mark - three nodes joined to a central one (a "second brain" of linked notes).
 * White on transparent: meant for the indigo sidebar/header or the brand badge. The app icons
 * in public/ are generated from the same geometry (scripts/generate-icons.mjs).
 */
@Component({
  selector: 'app-synap-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="16" y1="16" x2="16"    y2="6"  stroke="rgba(255,255,255,0.38)" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="16" y1="16" x2="24.66" y2="21" stroke="rgba(255,255,255,0.38)" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="16" y1="16" x2="7.34"  y2="21" stroke="rgba(255,255,255,0.38)" stroke-width="1.75" stroke-linecap="round"/>
      <circle cx="16"    cy="6"  r="2.5" fill="rgba(255,255,255,0.65)"/>
      <circle cx="24.66" cy="21" r="2.5" fill="rgba(255,255,255,0.65)"/>
      <circle cx="7.34"  cy="21" r="2.5" fill="rgba(255,255,255,0.65)"/>
      <circle cx="16"    cy="16" r="5"   fill="white"/>
    </svg>
  `,
  styles: [`:host { display: inline-flex; }`],
})
export class SynapLogoComponent {
  readonly size = input(28);
}
