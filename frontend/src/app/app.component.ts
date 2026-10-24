import {Component, inject} from '@angular/core';
import {AsyncPipe} from '@angular/common';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {JiraStoreService} from './core/jira/jira-store.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AsyncPipe, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html'
})
export class AppComponent {
  protected readonly jira = inject(JiraStoreService);
}
