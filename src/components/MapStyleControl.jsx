import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import mapStyleIcon from '../assets/map-style-map.png';
import satelliteStyleIcon from '../assets/map-style-satellite.png';

const NEXT_STYLE_ICON = {
  standard: satelliteStyleIcon,
  satellite: mapStyleIcon,
};

export default function MapStyleControl({ style, onToggle }) {
  const map = useMap();

  useEffect(() => {
    const control = L.control({ position: 'topleft' });

    control.onAdd = () => {
      const container = L.DomUtil.create(
        'div',
        'leaflet-bar leaflet-control map-style-control'
      );
      const btn = L.DomUtil.create('button', 'map-style-control__btn', container);
      const icon = L.DomUtil.create('img', 'map-style-control__icon', btn);
      const nextStyle = style === 'standard' ? 'satellite' : 'standard';

      btn.type = 'button';
      btn.title = `Switch to ${nextStyle} view`;
      btn.setAttribute('aria-label', btn.title);
      btn.setAttribute('aria-pressed', 'false');
      icon.src = NEXT_STYLE_ICON[style] ?? satelliteStyleIcon;
      icon.alt = '';
      icon.setAttribute('aria-hidden', 'true');

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      L.DomEvent.on(btn, 'click', (event) => {
        L.DomEvent.stop(event);
        onToggle();
      });

      return container;
    };

    control.addTo(map);

    return () => {
      map.removeControl(control);
    };
  }, [map, onToggle, style]);

  return null;
}
