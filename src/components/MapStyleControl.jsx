import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import mapStyleIcon from '../assets/map-style-map.png';
import satelliteStyleIcon from '../assets/map-style-satellite.png';
import topoStyleIcon from '../assets/map-style-topo.png';

// Order the toggle button cycles through.
const STYLE_CYCLE = ['standard', 'satellite', 'topo'];

const STYLE_ICON = {
  standard: mapStyleIcon,
  satellite: satelliteStyleIcon,
  topo: topoStyleIcon,
};

const STYLE_LABEL = {
  standard: 'standard',
  satellite: 'satellite',
  topo: 'topographic',
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
      const currentIndex = STYLE_CYCLE.indexOf(style);
      const nextStyle = STYLE_CYCLE[(currentIndex + 1) % STYLE_CYCLE.length];

      btn.type = 'button';
      btn.title = `Switch to ${STYLE_LABEL[nextStyle]} view`;
      btn.setAttribute('aria-label', btn.title);
      btn.setAttribute('aria-pressed', 'false');
      // Preview the style the button will switch to.
      icon.src = STYLE_ICON[nextStyle] ?? satelliteStyleIcon;
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
