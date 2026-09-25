import {
  animate,
  group,
  query,
  style,
  transition,
  trigger,
} from '@angular/animations';

export const routeAnimations = trigger('routeAnimation', [
  transition('* <=> *', [
    query(':enter, :leave', style({ position: 'absolute', width: '100%' }), { optional: true }),
    group([
      query(':leave', [
        animate('140ms ease-in', style({ opacity: 0, transform: 'translateX(-8px)' })),
      ], { optional: true }),
      query(':enter', [
        style({ opacity: 0, transform: 'translateX(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateX(0)' })),
      ], { optional: true }),
    ]),
  ]),
]);
