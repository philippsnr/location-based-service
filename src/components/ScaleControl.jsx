import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

export default function ScaleControl() {
  const map = useMap()

  useEffect(() => {
    const control = L.control.scale({ imperial: false })
    control.addTo(map)
    return () => { map.removeControl(control) }
  }, [map])

  return null
}
