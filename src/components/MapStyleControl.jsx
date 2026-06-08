import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import mapStyleIcon from '../assets/map-style-map.png';
import satelliteStyleIcon from '../assets/map-style-satellite.png';

const darkStyleIcon =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-hidden="true">' +
      '<rect width="512" height="512" rx="96" fill="#2a2f3a"/>' +
      '<path d="M286 96c-56 16-96 68-96 128 0 75 61 136 136 136 22 0 43-5 61-14-23 56-77 96-139 96-82 0-148-66-148-148 0-94 84-176 186-198z" fill="#f2f4f8"/>' +
      '<circle cx="370" cy="146" r="12" fill="#f2c94c"/>' +
      '<circle cx="406" cy="190" r="7" fill="#f2c94c"/>' +
      '<circle cx="334" cy="206" r="6" fill="#f2c94c"/>' +
    '</svg>'
  );

const STYLE_ICONS = {
  standard: mapStyleIcon,
  dark: darkStyleIcon,
  satellite: satelliteStyleIcon,
};

export default function MapStyleControl({ style, styles, onSelect }) {
  const map = useMap();

  useEffect(() => {
    const control = L.control({ position: 'topleft' });

    control.onAdd = () => {
      const container = L.DomUtil.create(
        'div',
        'leaflet-bar leaflet-control map-style-control'
      );

      const buttonGroup = L.DomUtil.create('div', 'map-style-control__group', container);

      Object.entries(styles).forEach(([styleKey, styleConfig]) => {
        const btn = L.DomUtil.create('button', 'map-style-control__btn', buttonGroup);
        const img = L.DomUtil.create('img', 'map-style-control__icon', btn);
        const isActive = styleKey === style;
        btn.type = 'button';
        btn.title = `Switch to ${styleConfig.label.toLowerCase()} view`;
        btn.setAttribute('aria-label', btn.title);
        btn.setAttribute('aria-pressed', String(isActive));
        btn.dataset.active = String(isActive);
        img.src = STYLE_ICONS[styleKey] ?? STYLE_ICONS.standard;
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');

        L.DomEvent.on(btn, 'click', (event) => {
          L.DomEvent.stop(event);
          onSelect(styleKey);
        });
      });

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      return container;
    };

    control.addTo(map);

    return () => {
      map.removeControl(control);
    };
  }, [map, onSelect, style, styles]);

  return null;
}
