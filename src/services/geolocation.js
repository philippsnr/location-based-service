// Helpers for surfacing geolocation problems to the user. Browsers never
// re-prompt for a permission the user already denied, so the app has to detect
// that state and explain how to recover.

export const GEO_DENIED_MESSAGE =
  'Location access is blocked. Enable location for this site in your browser ' +
  '(tap the lock or site-settings icon in the address bar), then try again.';

// Map a GeolocationPositionError (or a Leaflet locationerror, which carries the
// same numeric `code`) to a clear, actionable message.
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

// Resolve the current geolocation permission state ('granted' | 'denied' |
// 'prompt'), or null if the Permissions API isn't available so callers can fall
// back to attempting the request directly.
export async function getGeolocationPermissionState() {
  if (!navigator.permissions?.query) return null;
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return null;
  }
}
