import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AalButton } from '@aal/components/button';
import { AalLink } from '@aal/components/link';
import { AalSkipLink } from '@aal/components/skip-link';
import { AalTextField } from '@aal/components/text-field';
import { AalCheckbox, AalRadioGroup, AalSwitch } from '@aal/components/choice';
import type { AalRadioOption } from '@aal/components/choice';

@Component({
  imports: [RouterOutlet, AalButton, AalLink, AalSkipLink, AalTextField, AalCheckbox, AalSwitch, AalRadioGroup],
  selector: 'aal-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('Angular Aria Library');

  /** Demo form data. The docs app is the Playwright and Lighthouse audit
   *  target (NFR-13), so it exercises the real components. */
  protected readonly deliveryOptions: AalRadioOption[] = [
    { value: 'standard', label: 'Standard delivery', hint: 'Arrives in 3–5 working days' },
    { value: 'express', label: 'Express delivery', hint: 'Next working day' },
    { value: 'collect', label: 'Click and collect' },
  ];
}
