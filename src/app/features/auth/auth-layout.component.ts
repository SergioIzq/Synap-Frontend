import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterOutlet],
  styles: [`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 40%, #ede9fe 100%);
    }
  `],
  template: `<router-outlet />`,
})
export class AuthLayoutComponent {}
