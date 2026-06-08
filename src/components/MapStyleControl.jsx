import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

export default function MapStyleControl({ style, styles, onSelect }) {
  const map = useMap();

  useEffect(() => {
    const control = L.control({ position: 'topright' });

    control.onAdd = () => {
      const container = L.DomUtil.create(
        'div',
        'leaflet-bar leaflet-control map-style-control'
      );

      const buttonGroup = L.DomUtil.create('div', 'map-style-control__group', container);
      Object.entries(styles).forEach(([styleKey, styleConfig]) => {
        const btn = L.DomUtil.create('button', 'map-style-control__btn', buttonGroup);
        const isActive = styleKey === style;
        btn.type = 'button';
        btn.title = `Switch to ${styleConfig.label.toLowerCase()} view`;
        btn.setAttribute('aria-label', btn.title);
        btn.setAttribute('aria-pressed', String(isActive));
        btn.dataset.active = String(isActive);
        btn.textContent = styleConfig.label;

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
