const WEATHER_API_BASE = 'https://api.open-meteo.com/v1/forecast';
const CURRENT_PARAM_CANDIDATES = [
  'temperature_2m,apparent_temperature,weathercode,windspeed_10m,winddirection_10m,relative_humidity_2m,uv_index',
  'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,uv_index',
];

const WMO_WEATHER_MAP = {
  0: { description: 'Clear sky', icon: '☀️' },
  1: { description: 'Mainly clear', icon: '🌤️' },
  2: { description: 'Partly cloudy', icon: '⛅' },
  3: { description: 'Overcast', icon: '☁️' },
  45: { description: 'Fog', icon: '🌫️' },
  48: { description: 'Depositing rime fog', icon: '🌫️' },
  51: { description: 'Light drizzle', icon: '🌦️' },
  53: { description: 'Moderate drizzle', icon: '🌦️' },
  55: { description: 'Dense drizzle', icon: '🌧️' },
  56: { description: 'Light freezing drizzle', icon: '🌧️' },
  57: { description: 'Dense freezing drizzle', icon: '🌧️' },
  61: { description: 'Slight rain', icon: '🌧️' },
  63: { description: 'Moderate rain', icon: '🌧️' },
  65: { description: 'Heavy rain', icon: '🌧️' },
  66: { description: 'Light freezing rain', icon: '🌧️' },
  67: { description: 'Heavy freezing rain', icon: '🌧️' },
  71: { description: 'Slight snow fall', icon: '🌨️' },
  73: { description: 'Moderate snow fall', icon: '🌨️' },
  75: { description: 'Heavy snow fall', icon: '❄️' },
  77: { description: 'Snow grains', icon: '🌨️' },
  80: { description: 'Slight rain showers', icon: '🌦️' },
  81: { description: 'Moderate rain showers', icon: '🌧️' },
  82: { description: 'Violent rain showers', icon: '⛈️' },
  85: { description: 'Slight snow showers', icon: '🌨️' },
  86: { description: 'Heavy snow showers', icon: '❄️' },
  95: { description: 'Thunderstorm', icon: '⛈️' },
  96: { description: 'Thunderstorm with slight hail', icon: '⛈️' },
  99: { description: 'Thunderstorm with heavy hail', icon: '⛈️' },
};

function getWeatherMeta(weatherCode) {
  return WMO_WEATHER_MAP[weatherCode] ?? {
    description: 'Unknown weather condition',
    icon: '❔',
  };
}

export async function fetchWeather(lat, lng) {
  const lastErrors = [];

  for (const currentParam of CURRENT_PARAM_CANDIDATES) {
    const url = new URL(WEATHER_API_BASE);
    url.searchParams.set('latitude', lat);
    url.searchParams.set('longitude', lng);
    url.searchParams.set('current', currentParam);
    url.searchParams.set('daily', 'sunrise,sunset');
    url.searchParams.set('timezone', 'auto');

    let response;
    try {
      response = await fetch(url);
    } catch (error) {
      lastErrors.push(
        `request failed for current=${currentParam}: ${error instanceof Error ? error.message : String(error)}`
      );
      continue;
    }

    if (!response.ok) {
      lastErrors.push(
        `request failed for current=${currentParam}: ${response.status} ${response.statusText}`.trim()
      );
      continue;
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      lastErrors.push(
        `invalid JSON for current=${currentParam}: ${error instanceof Error ? error.message : String(error)}`
      );
      continue;
    }

    const current = data?.current;
    if (!current) {
      lastErrors.push(`missing current weather data for current=${currentParam}`);
      continue;
    }

    const weatherCode = current.weathercode ?? current.weather_code;
    const weatherMeta = getWeatherMeta(weatherCode);

    const parseTime = (iso) => iso ? iso.split('T')[1]?.slice(0, 5) : null;
    const sunrise = parseTime(data?.daily?.sunrise?.[0]);
    const sunset  = parseTime(data?.daily?.sunset?.[0]);

    const humidity = current.relative_humidity_2m ?? null;
    const uvIndex = current.uv_index != null ? Math.round(current.uv_index) : null;

    return {
      temperature: current.temperature_2m,
      apparentTemperature: current.apparent_temperature ?? null,
      weatherCode,
      windSpeed: current.windspeed_10m ?? current.wind_speed_10m,
      windDirection: current.winddirection_10m ?? current.wind_direction_10m ?? null,
      description: `${weatherMeta.description} ${weatherMeta.icon}`,
      icon: weatherMeta.icon,
      sunrise,
      sunset,
      humidity,
      uvIndex,
      timezone: data.timezone ?? null,
    };
  }

  throw new Error(`Open-Meteo weather fetch failed: ${lastErrors.join('; ')}`);
}
