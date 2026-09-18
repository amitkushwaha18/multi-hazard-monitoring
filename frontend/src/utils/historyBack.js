import { useEffect, useRef } from 'react';

/**
 * Browser-back navigation helper for the SPA.
 *
 * The app is a single-page application with no real routing, so the mobile
 * back button would normally leave the website entirely. To make Back step
 * through the internal application state instead, we:
 *
 *   1. push a synthetic history entry whenever the user "goes deeper"
 *      (opens a modal, navigates to Login/Register, logs into a Dashboard).
 *   2. On `popstate`, close the top-most open overlay (modal / profile menu);
 *      if none is open, App.jsx reverts Dashboard or Login/Register views
 *      back to the Landing page.
 *
 * Overlays self-register a "closer" so the central `popstate` handler knows
 * exactly what to dismiss.
 */

// Ordered list of closer functions registered by currently-open overlays
// (modals, profile menus, auth dialogs). Insertion order mirrors the
// browser history stack: the last registered layer is the one popped first.
const overlayClosers = [];

/**
 * Push a synthetic history entry so the browser Back button lands back
 * inside the app instead of leaving the page.
 */
export function pushInternalPage() {
  if (typeof window === 'undefined') return;
  try {
    window.history.pushState({ page: 'internal' }, '');
  } catch (err) {
    // Some browsers reject pushState in exotic sandboxes; fail silently.
    console.warn('pushState failed:', err);
  }
}

/**
 * Register an overlay's close callback. Returns an unregister function.
 * The closer is removed as soon as the overlay is dismissed normally, so
 * Back only ever closes overlays that are actually still open.
 */
export function registerModalCloser(closer) {
  overlayClosers.push(closer);
  return () => {
    const idx = overlayClosers.indexOf(closer);
    if (idx !== -1) overlayClosers.splice(idx, 1);
  };
}

/**
 * Close the top-most open overlay (LIFO order matching browser history).
 * Returns true when an overlay was closed, false when nothing was open.
 */
export function closeTopOverlay() {
  if (overlayClosers.length === 0) return false;
  const closer = overlayClosers.pop();
  try {
    closer();
  } catch (err) {
    console.warn('Overlay close handler threw:', err);
  }
  return true;
}

/**
 * React hook that ties an open/close-ed overlay to the browser Back button.
 *
 * When `isOpen` flips to true a history entry is pushed and the overlay's
 * `onClose` is registered as the top-most closer. When the overlay closes
 * (normally or via Back) the registration is removed. A ref keeps the hook
 * idempotent against React StrictMode's double-effect invocation in dev so
 * only one history entry is pushed per open.
 */
export function useOverlayHistory(isOpen, onClose) {
  const registeredRef = useRef(false);
  const closerRef = useRef(onClose);
  closerRef.current = onClose;

  useEffect(() => {
    if (!isOpen) {
      registeredRef.current = false;
      return undefined;
    }

    if (!registeredRef.current) {
      registeredRef.current = true;
      pushInternalPage();
    }

    return registerModalCloser(() => closerRef.current());
  }, [isOpen]);
}