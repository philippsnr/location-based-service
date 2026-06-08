import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-routing-machine'

// routing.openstreetmap.de has per-profile servers with correct data;
// router.project-osrm.org only carries car data and ignores other profiles.
const OSRM_ROUTER = {
  car: { serviceUrl: 'https://routing.openstreetmap.de/routed-car/route/v1', profile: 'driving' },
  foot: { serviceUrl: 'https://routing.openstreetmap.de/routed-foot/route/v1', profile: 'foot' },
  bike: { serviceUrl: 'https://routing.openstreetmap.de/routed-bike/route/v1', profile: 'bike' },
}

export default function RoutingMachine({ waypoints, profile = 'car', onRouteFound }) {
  const map = useMap()

  useEffect(() => {
    if (!waypoints || waypoints.length < 2) return undefined

    const { serviceUrl, profile: osrmProfile } = OSRM_ROUTER[profile] ?? OSRM_ROUTER.car

    const control = L.Routing.control({
      waypoints,
      router: L.Routing.osrmv1({
        serviceUrl,
        profile: osrmProfile,
        suppressDemoServerWarning: true,
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
      if (!route) return
      if (onRouteFound) {
        onRouteFound({ distance: route.summary.totalDistance, duration: route.summary.totalTime })
      }
      if (route.coordinates?.length > 1) {
        map.flyToBounds(L.latLngBounds(route.coordinates), { padding: [50, 50], maxZoom: 15, duration: 1.2 })
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
