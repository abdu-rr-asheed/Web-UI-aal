import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AalButton } from '@aal/components/button';
import { AalLink } from '@aal/components/link';
import { AalSkipLink } from '@aal/components/skip-link';
import { AalTextField } from '@aal/components/text-field';
import { AalCheckbox, AalRadioGroup, AalSwitch } from '@aal/components/choice';
import { AalNativeSelect, AalSelect } from '@aal/components/select';
import { AalDialog } from '@aal/components/dialog';
import { AalAlert } from '@aal/components/alert';
import { AalDisclosure } from '@aal/components/disclosure';
import { AalTooltip } from '@aal/components/tooltip';
import { AalNav } from '@aal/components/nav';
import { AalTab, AalTabs } from '@aal/components/tabs';
import { AalMenu } from '@aal/components/menu';
import { AalBreadcrumb } from '@aal/components/breadcrumb';
import { AalPagination } from '@aal/components/pagination';
import type { AalSelectOption } from '@aal/components/select';
import type { AalRadioOption } from '@aal/components/choice';
import type { AalNavItem } from '@aal/components/nav';
import type { AalMenuItem } from '@aal/components/menu';
import type { AalBreadcrumbItem } from '@aal/components/breadcrumb';

@Component({
  imports: [RouterOutlet, AalButton, AalLink, AalSkipLink, AalTextField, AalCheckbox, AalSwitch, AalRadioGroup, AalSelect, AalNativeSelect, AalDialog, AalAlert, AalDisclosure, AalTooltip, AalNav, AalTabs, AalTab, AalMenu, AalBreadcrumb, AalPagination],
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

  protected readonly dialogOpen = signal(false);
  protected readonly lastDialogReason = signal('');

  protected readonly countryOptions: AalSelectOption[] = [
    { value: 'uk', label: 'United Kingdom' },
    { value: 'ie', label: 'Ireland' },
    { value: 'fr', label: 'France' },
    { value: 'de', label: 'Germany' },
    { value: 'es', label: 'Spain' },
    { value: 'ru', label: 'Russia', disabled: true },
  ];

  /**
   * Site navigation, built with the Disclosure Navigation Menu pattern rather
   * than role="menu" (ADR-0005). The docs shell is the Lighthouse and
   * Playwright audit target, so this is the real component under test.
   */
  protected readonly navItems: AalNavItem[] = [
    { label: 'Home', href: '/', current: true },
    {
      label: 'Components',
      children: [
        { label: 'Buttons and links', href: '/components/button' },
        { label: 'Form controls', href: '/components/forms' },
        { label: 'Overlays', href: '/components/overlays' },
        { label: 'Navigation', href: '/components/navigation' },
      ],
    },
    { label: 'Audit reports', href: '/reports' },
  ];

  protected readonly crumbs: AalBreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Components', href: '/components' },
    { label: 'Navigation' },
  ];

  protected readonly rowActions: AalMenuItem[] = [
    { value: 'rename', label: 'Rename' },
    { value: 'duplicate', label: 'Duplicate' },
    { value: 'export', label: 'Export as CSV', disabled: true },
    { value: 'delete', label: 'Delete', separatorBefore: true },
  ];

  protected readonly lastAction = signal('');
  protected readonly resultsPage = signal(4);
}
