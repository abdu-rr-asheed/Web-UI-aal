import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model } from '@angular/core';
import { AalLiveAnnouncer } from '@aal/a11y-core';

/**
 * Pagination (PRD §9.9).
 *
 * Not an APG pattern — the APG has no pagination widget, so the semantics here
 * are assembled from the criteria that apply rather than copied from a
 * reference implementation. That is worth stating plainly: where the APG is
 * silent, the conformance argument has to be made from the SC directly.
 *
 * ## The failure this exists to prevent
 *
 * Changing page replaces the content the user was reading, and does it without
 * a page load. For a sighted user the change is obvious. For a screen-reader
 * user it is completely silent: focus is still on the button they pressed, the
 * virtual cursor has not moved, and nothing has been announced. They have no
 * way to know whether anything happened at all.
 *
 * So the change is announced politely (SC 4.1.3), and focus is deliberately
 * left on the pressed control (SC 2.4.7 / 3.2.2) rather than moved into the
 * results — moving it would take a user who is stepping through several pages
 * away from the control they are using, forcing them back to it each time.
 *
 * ## Numbered buttons, not links
 *
 * These are `<button>`s because nothing navigates: the URL is unchanged and
 * the content is replaced in place. A `<a href="#">` announces itself as a
 * link, so the user expects a page change and a new reading position, and gets
 * neither. Consumers whose pagination genuinely does navigate should render
 * links inside a `<nav>` themselves — the honest answer, rather than a
 * `linkMode` input that produces the wrong semantics half the time.
 */
@Component({
  selector: 'aal-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './pagination.css',
  template: `
    <nav class="aal-pagination" [attr.aria-label]="label()">
      <!--
        aria-disabled, not the native disabled attribute.

        Pressing Previous repeatedly to reach page 1 makes the button the user
        is standing on unfocusable at the moment it becomes unavailable, so
        focus falls to <body> and a keyboard user is dumped at the top of the
        document. The same reasoning as AalButton's loading state: the cost is
        that the control stays clickable, so goTo() refuses out-of-range moves
        explicitly.
      -->
      <button
        type="button"
        class="aal-pagination__step"
        [attr.aria-disabled]="page() <= 1 ? 'true' : null"
        (click)="goTo(page() - 1)"
      >
        <span class="aal-pagination__marker" aria-hidden="true">‹</span>
        Previous
      </button>

      <ul class="aal-pagination__list">
        @for (entry of entries(); track entry.key) {
          <li>
            @if (entry.page === null) {
              <!--
                An elided range. Announced as text rather than drawn as "…",
                because an ellipsis character is read as nothing at all by some
                screen readers and as "horizontal ellipsis" by others.
              -->
              <span class="aal-pagination__gap">
                <span aria-hidden="true">…</span>
                <span class="aal-visually-hidden">skipping pages</span>
              </span>
            } @else {
              <button
                type="button"
                class="aal-pagination__page"
                [class.aal-pagination__page--current]="entry.page === page()"
                [attr.aria-current]="entry.page === page() ? 'page' : null"
                [attr.aria-label]="'Page ' + entry.page"
                (click)="goTo(entry.page)"
              >
                {{ entry.page }}
              </button>
            }
          </li>
        }
      </ul>

      <button
        type="button"
        class="aal-pagination__step"
        [attr.aria-disabled]="page() >= totalPages() ? 'true' : null"
        (click)="goTo(page() + 1)"
      >
        Next
        <span class="aal-pagination__marker" aria-hidden="true">›</span>
      </button>
    </nav>
  `,
})
export class AalPagination {
  private readonly announcer = inject(AalLiveAnnouncer);

  /**
   * Landmark name. Defaults to "Pagination"; a page with two paginated
   * regions must name them apart, or they are indistinguishable in a
   * screen reader's landmark list.
   */
  readonly label = input('Pagination');

  readonly totalPages = input.required<number>();

  /** 1-based. Two-way bindable. */
  readonly page = model(1);

  /** How many numbered buttons to show either side of the current page. */
  readonly siblings = input(1);

  private previousPage = this.page();

  /**
   * The numbers to render, with elisions.
   *
   * First and last are always present so the user can always reach either end
   * in one press — without them, reaching page 1 from page 40 means pressing
   * Previous thirty-nine times.
   */
  protected readonly entries = computed<{ key: string; page: number | null }[]>(() => {
    const total = Math.max(this.totalPages(), 1);
    const current = Math.min(Math.max(this.page(), 1), total);
    const span = Math.max(this.siblings(), 0);

    const shown = new Set<number>([1, total]);
    for (let p = current - span; p <= current + span; p++) {
      if (p >= 1 && p <= total) shown.add(p);
    }

    const sorted = [...shown].sort((a, b) => a - b);
    const out: { key: string; page: number | null }[] = [];

    for (const [i, p] of sorted.entries()) {
      const previous = sorted[i - 1];
      if (previous !== undefined && p - previous > 1) {
        out.push({ key: `gap-${previous}`, page: null });
      }
      out.push({ key: `page-${p}`, page: p });
    }

    return out;
  });

  constructor() {
    /**
     * Announce the change politely, never assertively. Assertive would cut
     * across whatever the user is currently reading, and a page change is not
     * an emergency — it is the thing they just asked for.
     *
     * Only on an actual change: re-announcing the same page because some other
     * input happened to update is noise, and noise is what teaches people to
     * ignore live regions.
     */
    effect(() => {
      const current = this.page();
      if (current === this.previousPage) return;
      this.previousPage = current;
      this.announcer.polite(`Page ${current} of ${this.totalPages()}`);
    });
  }

  protected goTo(target: number): void {
    const clamped = Math.min(Math.max(target, 1), Math.max(this.totalPages(), 1));
    if (clamped === this.page()) return;
    this.page.set(clamped);
  }
}
