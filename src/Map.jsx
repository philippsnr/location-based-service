import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './Map.css'

const position = [51.505, -0.09]
const marker = [51.505, -0.08]

function Map() {
  return (
    <MapContainer center={position} zoom={15} scrollWheelZoom={true} className="map-container">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={marker}>
        <Popup>
          Name of the place <br /> Easily customizable.
        </Popup>
      </Marker>
    </MapContainer>
  )
}

export default Map