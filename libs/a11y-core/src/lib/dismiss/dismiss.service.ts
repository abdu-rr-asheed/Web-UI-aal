import { DOCUMENT, Injectable, inject } from '@angular/core';

export type DismissReason = 'escape' | 'outside-pointer' | 'focus-loss' | 'programmatic';

export interface DismissLayerOptions {
  readonly onDismiss: (reason: DismissReason) => void;
  /** Default true. SC 2.1.2 requires an Escape route out of a modal layer. */
  readonly escape?: boolean;
  /** Default true. Tooltips set false — they dismiss on Escape and blur only. */
  readonly outsidePointer?: boolean;
}

export interface DismissLayerRef {
  /** Dismiss this layer and remove it from the stack. */
  dismiss(reason?: DismissReason): void;
  /** True when this layer is the top-most one, and therefore what Escape targets. */
  isTop(): boolean;
}

/**
 * A dismiss-layer stack for overlays (AR-15, AR-21).
 *
 * Every overlay pushes a layer; Escape dismisses ONLY the top-most one. That
 * is what SC 2.1.2 requires, and it is precisely what naive implementations
 * get wrong: attach an Escape handler per component, then open a confirmation
 * dialog from inside a dialog, and one Escape closes both. The user loses
 * their work with no idea why.
 *
 * No component can know what is stacked above it, so a single shared stack
 * with one document-level listener is the only way to get this right.
 */
@Injectable({ providedIn: 'root' })
export class DismissService {
  private readonly doc = inject(DOCUMENT);

  private readonly layers: { element: HTMLElement; options: DismissLayerOptions }[] = [];
  private listening = false;

  /** Number of currently open layers. */
  get depth(): number {
    return this.layers.length;
  }

  /** Push a layer onto the stack. */
  register(element: HTMLElement, options: DismissLayerOptions): DismissLayerRef {
    const layer = { element, options };
    this.layers.push(layer);
    this.startListening();

    return {
      dismiss: (reason: DismissReason = 'programmatic') => {
        const i = this.layers.indexOf(layer);
        if (i === -1) return; // already dismissed
        this.layers.splice(i, 1);
        if (this.layers.length === 0) this.stopListening();
        options.onDismiss(reason);
      },
      isTop: () => this.layers.at(-1) === layer,
    };
  }

  private startListening(): void {
    if (this.listening) return;
    this.listening = true;
    // Capture phase: the stack must see Escape before content inside a layer
    // can stopPropagation and strand the user with no way out.
    this.doc.addEventListener('keydown', this.onKeydown, true);
    this.doc.addEventListener('pointerdown', this.onPointerDown, true);
  }

  private stopListening(): void {
    if (!this.listening) return;
    this.listening = false;
    this.doc.removeEventListener('keydown', this.onKeydown, true);
    this.doc.removeEventListener('pointerdown', this.onPointerDown, true);
  }

  private readonly onKeydown = (event: Event): void => {
    const e = event as KeyboardEvent;
    if (e.key !== 'Escape') return;

    const top = this.layers.at(-1);
    if (!top || top.options.escape === false) return;

    e.preventDefault();
    e.stopPropagation();
    this.pop('escape');
  };

  private readonly onPointerDown = (event: Event): void => {
    const top = this.layers.at(-1);
    if (!top || top.options.outsidePointer === false) return;

    const target = event.target as Node | null;
    if (target && top.element.contains(target)) return;

    this.pop('outside-pointer');
  };

  private pop(reason: DismissReason): void {
    const top = this.layers.pop();
    if (!top) return;
    if (this.layers.length === 0) this.stopListening();
    top.options.onDismiss(reason);
  }

  /** Test-only: clear the stack and detach listeners. */
  resetForTesting(): void {
    this.layers.length = 0;
    this.stopListening();
  }
}
