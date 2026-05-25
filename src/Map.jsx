import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './Map.css'

const position = [54.4047, 10.2256]
const marker = [54.4047, 10.2256]

function Map() {
  return (
    <MapContainer center={position} zoom={15} scrollWheelZoom={true} className="map-container">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={marker}>
        <Popup>
          Name of the place <br /> LABOE!!!!!
        </Popup>
      </Marker>
    </MapContainer>
  )
}

export default Map