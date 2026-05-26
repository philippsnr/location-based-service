import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-routing-machine'

const DEFAULT_WAYPOINTS = [
  L.latLng(53.5511, 9.9937),
  L.latLng(52.52, 13.405),
]

export default function RoutingMachine({ waypoints = DEFAULT_WAYPOINTS }) {
  const map = useMap()

  useEffect(() => {
    const control = L.Routing.control({
      waypoints,
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
      }),
      routeWhileDragging: false,
      addWaypoints: false,
      showAlternatives: false,
    }).addTo(map)

    return () => {
      map.removeControl(control)
    }
  }, [map, waypoints])

  return null
}
