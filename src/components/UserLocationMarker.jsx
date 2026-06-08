import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export function requestOrientationPermission() {
  if (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  ) {
    DeviceOrientationEvent.requestPermission().catch(() => {});
  }
}

export default function UserLocationMarker({ position }) {
  const map = useMap();
  const markerRef = useRef(null);

  // Create marker object once; add/remove from map based on position.
  useEffect(() => {
    const icon = L.divIcon({
      html:
        '<div class="ulm-wrapper">' +
          '<svg class="ulm-cone" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">' +
            '<polygon points="12,1 0,24 24,24" fill="rgba(0,122,255,0.32)"/>' +
          '</svg>' +
          '<div class="ulm-dot"></div>' +
        '</div>',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      className: '',
    });
    const marker = L.marker([0, 0], { icon, interactive: false, zIndexOffset: -100 });
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (position) {
      marker.setLatLng(position);
      if (!map.hasLayer(marker)) marker.addTo(map);
    } else {
      marker.remove();
    }
  }, [position, map]);

  // DeviceOrientation → rotate the cone in real time without React re-renders.
  useEffect(() => {
    let hasAbsolute = false;

    const updateHeading = (heading) => {
      const wrapper = markerRef.current?.getElement()?.querySelector('.ulm-wrapper');
      if (wrapper) wrapper.style.transform = `rotate(${heading}deg)`;
    };

    // deviceorientationabsolute: alpha=0 at north, increases counterclockwise
    // → compass heading = (360 - alpha) % 360
    const handleAbsolute = (e) => {
      if (e.alpha == null) return;
      hasAbsolute = true;
      updateHeading((360 - e.alpha) % 360);
    };

    // deviceorientation fallback: use webkitCompassHeading (iOS) or alpha
    const handleOrientation = (e) => {
      if (hasAbsolute || e.alpha == null) return;
      const heading =
        e.webkitCompassHeading != null
          ? e.webkitCompassHeading
          : (360 - e.alpha) % 360;
      updateHeading(heading);
    };

    window.addEventListener('deviceorientationabsolute', handleAbsolute, true);
    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleAbsolute, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  return null;
}
