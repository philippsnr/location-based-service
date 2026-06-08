import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

export default function MapStyleControl({ style, onToggle }) {
  const map = useMap();

  useEffect(() => {
    const control = L.control({ position: 'topright' });

    control.onAdd = () => {
      const container = L.DomUtil.create(
        'div',
        'leaflet-bar leaflet-control map-style-control'
      );
      const btn = L.DomUtil.create('button', 'map-style-control__btn', container);
      btn.type = 'button';
      btn.title = style === 'standard' ? 'Switch to satellite view' : 'Switch to standard view';
      btn.setAttribute('aria-label', btn.title);
      btn.textContent = style === 'standard' ? 'Satellite' : 'Standard';

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
