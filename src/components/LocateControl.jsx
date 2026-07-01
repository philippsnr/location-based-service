import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { requestOrientationPermission } from './UserLocationMarker'
import {
  GEO_DENIED_MESSAGE,
  geolocationErrorMessage,
  getGeolocationPermissionState,
} from '../services/geolocation'

/**
 * @file Custom Leaflet "locate me" button. Shows the current position,
 * animates the map to it, and surfaces actionable messages when geolocation
 * is denied or fails.
 */

/**
 * @typedef {Object} LocateControlProps
 * @property {(latlng: import('leaflet').LatLng, accuracy: number) => void} onLocate
 *   Fires when the browser resolves the user's position; `accuracy` is the
 *   radius in metres reported by the Geolocation API.
 * @property {(message: string) => void} [onError]
 *   Optional handler invoked with a human-readable string when the request is
 *   denied (matches {@link GEO_DENIED_MESSAGE}) or the browser reports a
 *   `locationerror`.
 */

/**
 * Renders a "locate me" button in the top-left Leaflet control corner. On
 * click it requests device-orientation permission (iOS), checks the
 * geolocation permission state up front to explain a prior denial, then asks
 * the map to locate and flies to the resolved position.
 * @param {LocateControlProps} props
 * @returns {null}
 */
export default function LocateControl({ onLocate, onError }) {
  const map = useMap()

  useEffect(() => {
    const control = L.control({ position: 'topleft' })

    control.onAdd = () => {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control locate-control')
      const btn = L.DomUtil.create('button', 'locate-btn', container)
      btn.type = 'button'
      btn.title = 'Locate me'
      btn.setAttribute('aria-label', 'Locate me')
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>' +
        '</svg>'
      L.DomEvent.disableClickPropagation(container)
      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.stop(e)
        requestOrientationPermission()
        // Detect an already-denied permission up front: the browser won't
        // re-prompt, so explain how to recover instead of failing silently.
        getGeolocationPermissionState().then((state) => {
          if (state === 'denied') {
            onError?.(GEO_DENIED_MESSAGE)
            return
          }
          // setView:false so we can animate to the location ourselves via flyTo
          // in the locationfound handler instead of snapping there instantly.
          map.locate({ setView: false, maxZoom: 16, enableHighAccuracy: true })
        })
      })
      return container
    }

    control.addTo(map)

    const handleFound = (e) => {
      // Smoothly animate to the user's location instead of jumping. flyTo
      // scales the animation to the distance, so nearby targets stay quick.
      const zoom = Math.max(map.getZoom(), 16)
      map.flyTo(e.latlng, zoom, { duration: 1.2 })
      onLocate(e.latlng, e.accuracy)
    }
    const handleError = (e) => {
      // Leaflet's locationerror carries the same numeric `code` as a
      // GeolocationPositionError; surface a clear, actionable message.
      onError?.(geolocationErrorMessage(e))
    }
    map.on('locationfound', handleFound)
    map.on('locationerror', handleError)

    return () => {
      map.off('locationfound', handleFound)
      map.off('locationerror', handleError)
      map.removeControl(control)
    }
  }, [map, onLocate, onError])

  return null
}
