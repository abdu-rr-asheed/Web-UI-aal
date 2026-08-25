import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface AalBreadcrumbItem {
  readonly label: string;
  /** Omit on the final crumb — the current page is not a link to itself. */
  readonly href?: string;
}

/**
 * Breadcrumb (PRD §9.9, APG Breadcrumb).
 *
 * Small enough that it is usually hand-written, and usually hand-written
 * wrong. Four things this gets right that a `<div>` of links does not:
 *
 * 1. **A named `<nav>` landmark.** A page typically has several `<nav>`
 *    elements, and a screen-reader user reaches them through a landmark list.
 *    Two unnamed ones are indistinguishable there; "Breadcrumb" is how this
 *    one is told apart from the primary navigation.
 *
 * 2. **An ordered list.** The trail is a hierarchy, and `<ol>` is what says so.
 *    A screen reader announces "list, 4 items" and the position within it, so
 *    the user learns how deep the current page sits without reading the whole
 *    trail.
 *
 * 3. **The current page is not a link.** A link to the page you are already on
 *    is announced as a link and does nothing. It is rendered as plain text
 *    with `aria-current="page"`, which is what tells assistive technology
 *    where the trail ends.
 *
 * 4. **Separators are decorative.** A "/" between crumbs read aloud as "slash"
 *    four times is noise, and the list structure already conveys the
 *    separation. They carry `aria-hidden` and are drawn by CSS rather than
 *    placed in the content, so they cannot be selected or copied either.
 */
@Component({
  selector: 'aal-breadcrumb',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './breadcrumb.css',
  template: `
    <nav class="aal-breadcrumb" [attr.aria-label]="label()">
      <ol class="aal-breadcrumb__list">
        @for (item of items(); track item.label; let last = $last) {
          <li class="aal-breadcrumb__item">
            @if (item.href && !last) {
              <a class="aal-breadcrumb__link" [attr.href]="item.href">{{ item.label }}</a>
            } @else {
              <!--
                The current page: text, not a link. aria-current="page" is what
                identifies it, so the styling below is free to change without
                affecting what a screen reader reports.
              -->
              <span class="aal-breadcrumb__current" aria-current="page">{{ item.label }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class AalBreadcrumb {
  /**
   * Landmark name. Defaults to "Breadcrumb", which is the convention screen-
   * reader users expect; override only to disambiguate two trails on one page.
   */
  readonly label = input('Breadcrumb');

  /** Root first, current page last. */
  readonly items = input.required<readonly AalBreadcrumbItem[]>();
}
