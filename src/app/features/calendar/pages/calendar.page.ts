import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CalendarViewComponent } from '../components/calendar-view.component';
import { CalendarStore } from '../store/calendar.store';

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalendarViewComponent],
  styles: [`
    :host { display: block; height: 100%; }
  `],
  template: `<app-calendar-view />`,
})
export class CalendarPage implements OnInit {
  private readonly store = inject(CalendarStore);

  ngOnInit(): void {
    void this.store.loadCalendars();
  }
}
