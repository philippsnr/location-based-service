const BASE_URL = 'https://nominatim.openstreetmap.org';

export async function reverseGeocode(lat, lng) {
  const res = await fetch(
    `${BASE_URL}/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&extratags=1&namedetails=1`,
    { headers: { 'Accept-Language': 'en' } }
  );
  const data = await res.json();

  const addr = data.address ?? {};
  const placeName =
    addr.attraction ||
    addr.tourism ||
    addr.amenity ||
    addr.leisure ||
    addr.historic ||
    addr.building ||
    addr.man_made ||
    addr.natural ||
    addr.park ||
    addr.village ||
    addr.town ||
    addr.city ||
    addr.suburb ||
    addr.neighbourhood ||
    addr.county ||
    addr.state ||
    addr.road ||
    data.name ||
    data.display_name?.split(',')[0] ||
    'Unknown location';

  return { placeName };
}