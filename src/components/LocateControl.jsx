import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

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
      btn.innerHTML = '◎'
      L.DomEvent.disableClickPropagation(container)
      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.stop(e)
        map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true })
      })
      return container
    }

    control.addTo(map)

    const handleFound = (e) => onLocate(e.latlng)
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
