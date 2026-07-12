/**
 * @file Helpers for surfacing geolocation problems to the user. Browsers never
 * re-prompt for a permission the user already denied, so the app has to detect
 * that state and explain how to recover.
 */

/**
 * User-facing message shown when location access has been denied.
 * @type {string}
 */
export const GEO_DENIED_MESSAGE =
  'Location access is blocked. Enable location for this site in your browser ' +
  '(tap the lock or site-settings icon in the address bar), then try again.';

/**
 * Map a geolocation error to a clear, actionable message.
 * @param {{code?: number}} error - A `GeolocationPositionError` (or a Leaflet
 *   `locationerror`, which carries the same numeric `code`).
 * @returns {string} A human-readable message for the given error code.
 */
export function geolocationErrorMessage(error) {
  switch (error?.code) {
    case 1: // PERMISSION_DENIED
      return GEO_DENIED_MESSAGE;
    case 2: // POSITION_UNAVAILABLE
      return 'Your location is currently unavailable. Please try again.';
    case 3: // TIMEOUT
      return 'Getting your location timed out. Please try again.';
    default:
      return 'Could not determine your location.';
  }
}

/**
 * Resolve the current geolocation permission state so callers can decide
 * whether to prompt, warn, or fall back to attempting the request directly.
 * @returns {Promise<'granted'|'denied'|'prompt'|null>} The permission state, or
 *   null when the Permissions API is unavailable or the query fails.
 */
export async function getGeolocationPermissionState() {
  if (!navigator.permissions?.query) return null;
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return null;
  }
}
