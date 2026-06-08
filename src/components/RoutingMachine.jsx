import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-routing-machine'

export default function RoutingMachine({ waypoints, profile = 'car', onRouteFound }) {
  const map = useMap()

  useEffect(() => {
    if (!waypoints || waypoints.length < 2) return undefined

    const control = L.Routing.control({
      waypoints,
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile,
      }),
      routeWhileDragging: false,
      addWaypoints: false,
      showAlternatives: false,
      draggableWaypoints: false,
      fitSelectedRoutes: false,
      show: false,
      createMarker: () => null,
      lineOptions: {
        addWaypoints: false,
        styles: [{ color: '#1976d2', weight: 5, opacity: 0.85 }],
      },
    }).addTo(map)

    control.on('routesfound', (e) => {
      const route = e.routes[0]
      if (route && onRouteFound) {
        onRouteFound({ distance: route.summary.totalDistance, duration: route.summary.totalTime })
      }
    })

    control.on('routingerror', (e) => {
      console.warn('OSRM routing error:', e.error)
    })

    return () => {
      map.removeControl(control)
    }
  }, [map, waypoints, profile])

  return null
}
