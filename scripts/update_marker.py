from pathlib import Path

path = Path('src/Map.jsx')
text = path.read_text()

text = text.replace(
    "import { useCallback, useState } from 'react';\nimport { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';\nimport 'leaflet/dist/leaflet.css';\nimport './Map.css';\nimport LocateControl from './components/LocateControl';\n",
    "import { useCallback, useState } from 'react';\nimport { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';\nimport L from 'leaflet';\nimport markerIconUrl from './assets/marker.png';\nimport 'leaflet/dist/leaflet.css';\nimport './Map.css';\nimport LocateControl from './components/LocateControl';\n",
)

text = text.replace(
    "const initialPosition = [54.4047, 10.2256];\n",
    "const initialPosition = [54.4047, 10.2256];\n\nconst customMarkerIcon = new L.Icon({\n  iconUrl: markerIconUrl,\n  iconRetinaUrl: markerIconUrl,\n  iconSize: [32, 32],\n  iconAnchor: [16, 32],\n  popupAnchor: [0, -32],\n});\n",
)

text = text.replace(
    "    <Marker position={position}>\n",
    "    <Marker position={position} icon={customMarkerIcon}>\n",
)

path.write_text(text)
