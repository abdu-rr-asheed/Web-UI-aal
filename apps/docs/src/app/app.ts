import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AalButton } from '@aal/components/button';
import { AalLink } from '@aal/components/link';
import { AalSkipLink } from '@aal/components/skip-link';

@Component({
  imports: [RouterOutlet, AalButton, AalLink, AalSkipLink],
  selector: 'aal-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('Angular Aria Library');
}
