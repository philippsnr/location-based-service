import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * @file Adds Leaflet's metric scale bar to the map (bottom-right).
 */

/**
 * Mounts a metric-only Leaflet scale control onto the map for its lifetime.
 * @returns {null} Renders no DOM of its own.
 */
export default function ScaleControl() {
  const map = useMap();

  useEffect(() => {
    const control = L.control.scale({ imperial: false, position: 'bottomright' });
    control.addTo(map);
    return () => {
      map.removeControl(control);
    };
  }, [map]);

  return null;
}
