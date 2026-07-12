import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';

/**
 * @file Draws a route between two or more waypoints on the Leaflet map using
 * OSRM, and reports the resulting distance/duration up to the parent.
 */

/**
 * Per-profile OSRM router configurations.
 *
 * routing.openstreetmap.de has per-profile servers with correct data;
 * router.project-osrm.org only carries car data and ignores other profiles.
 * @type {Record<'car' | 'foot' | 'bike', { serviceUrl: string, profile: string }>}
 */
const OSRM_ROUTER = {
  car: { serviceUrl: 'https://routing.openstreetmap.de/routed-car/route/v1', profile: 'driving' },
  foot: { serviceUrl: 'https://routing.openstreetmap.de/routed-foot/route/v1', profile: 'foot' },
  bike: { serviceUrl: 'https://routing.openstreetmap.de/routed-bike/route/v1', profile: 'bike' },
};

/**
 * @typedef {Object} RoutingMachineProps
 * @property {import('leaflet').LatLng[]} waypoints
 *   Ordered list of stops. Must contain at least two points; otherwise the
 *   effect is skipped.
 * @property {'car' | 'foot' | 'bike'} [profile='car']
 *   Travel mode selecting the OSRM profile server. Unknown values fall back to `'car'`.
 * @property {(info: { distance: number, duration: number }) => void} [onRouteFound]
 *   Fires once per route with `distance` in metres and `duration` in seconds.
 */

/**
 * Renders no DOM of its own; instead it attaches a Leaflet Routing Machine
 * control to the parent `MapContainer`, listens for the first route found,
 * fits the map to it, and reports the summary via `onRouteFound`.
 * @param {RoutingMachineProps} props
 * @returns {null}
 */
export default function RoutingMachine({ waypoints, profile = 'car', onRouteFound }) {
  const map = useMap();

  useEffect(() => {
    if (!waypoints || waypoints.length < 2) return undefined;

    const { serviceUrl, profile: osrmProfile } = OSRM_ROUTER[profile] ?? OSRM_ROUTER.car;

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
    }).addTo(map);

    control.on('routesfound', (e) => {
      const route = e.routes[0];
      if (!route) return;
      if (onRouteFound) {
        onRouteFound({ distance: route.summary.totalDistance, duration: route.summary.totalTime });
      }
      if (route.coordinates?.length > 1) {
        map.flyToBounds(L.latLngBounds(route.coordinates), {
          padding: [50, 50],
          maxZoom: 15,
          duration: 1.2,
        });
      }
    });

    control.on('routingerror', (e) => {
      console.warn('OSRM routing error:', e.error);
    });

    return () => {
      map.removeControl(control);
    };
  }, [map, waypoints, profile]);

  return null;
}
