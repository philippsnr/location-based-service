import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { requestOrientationPermission } from './UserLocationMarker'

export default function LocateControl({ onLocate }) {
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
        // setView:false so we can animate to the location ourselves via flyTo
        // in the locationfound handler instead of snapping there instantly.
        map.locate({ setView: false, maxZoom: 16, enableHighAccuracy: true })
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
      alert(e.message)
    }
    map.on('locationfound', handleFound)
    map.on('locationerror', handleError)

    return () => {
      map.off('locationfound', handleFound)
      map.off('locationerror', handleError)
      map.removeControl(control)
    }
  }, [map, onLocate])

  return null
}
