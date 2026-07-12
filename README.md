# Location Based Service

An interactive, mobile-first map application built as a **Progressive Web App (PWA)**. Tap anywhere on the map to learn about a place — its address, a Wikipedia summary, key facts, current weather and air quality, and elevation. You can also search for places, discover nearby points of interest, plan car / walking / cycling routes with an elevation profile, and save your favourite spots. Everything runs in the browser and works offline once loaded.

> This is a student project developed at DHBW (app id `de.dhbw.location-based-service`).

---

## Features

- **Interactive map** with three base layers: Standard (OpenStreetMap), Satellite (Esri World Imagery), and Topographic (OpenTopoMap).
- **Tap to inspect any location** — shows the place name and full address, a Wikipedia summary with photos, structured facts from Wikidata (population, area, year founded), current weather, air quality (AQI / particulate matter), and elevation.
- **Search** for any place by name.
- **Points of interest (POI) discovery** — filter and show nearby restaurants, cafés, supermarkets, pharmacies, ATMs, bars, hotels, museums, bus stops, and train stations.
- **Route planning** for car, foot, or bike, with distance, duration, and an **elevation profile chart** (total ascent / descent).
- **Find my location** using the browser's geolocation (optional — the app works fine if you decline).
- **Favourites** — save places; they persist in your browser and sync across open tabs.
- **Installable & offline-ready** — install it like a native app; map tiles and assets are cached for offline use.

## Tech stack

- **[React 18](https://react.dev/)** (JavaScript / JSX) — UI
- **[Vite 5](https://vitejs.dev/)** — build tool and dev server
- **[Framework7](https://framework7.io/)** — mobile UI shell
- **[MUI (Material UI)](https://mui.com/)** — components, icons, and theming
- **[Leaflet](https://leafletjs.com/)** + **[react-leaflet](https://react-leaflet.js.org/)** + **leaflet-routing-machine** — maps and routing
- **[vite-plugin-pwa](https://vite-pwa-org.netlify.app/)** — Progressive Web App / offline support

All map, weather, and place data comes from **free, public APIs** (OpenStreetMap Nominatim & Overpass, Open-Meteo, Wikipedia, Wikidata, OSRM). **No API keys or accounts are required.**

---

## Prerequisites

You only need two things, and both work the same on **Windows, macOS, and Linux**:

1. **[Node.js](https://nodejs.org/) version 20 or newer** (this includes `npm`). Download it from [nodejs.org](https://nodejs.org/).
2. **[Git](https://git-scm.com/)** to download the code.

No API keys, no `.env` file, and no extra configuration are needed.

## Getting started

Open a terminal (Terminal on macOS/Linux, PowerShell or Command Prompt on Windows) and run the following commands — they are identical on every operating system:

```bash
# 1. Download the project
git clone https://github.com/philippsnr/location-based-service.git

# 2. Go into the project folder
cd location-based-service

# 3. Install the dependencies (one-time)
npm install

# 4. Start the app in development mode
npm run dev
```

After step 4, Vite prints a local URL in the terminal (for example `http://localhost:5173/location-based-service/`). Open that URL in your browser and the app will load. It will ask for permission to use your location — you can allow or deny it; the app works either way.

## Available scripts

Run these from inside the project folder with `npm run <script>`:

| Script          | What it does                                              |
| --------------- | -------------------------------------------------------- |
| `dev`           | Start the local development server with hot reload.      |
| `build`         | Create an optimized production build in `dist/`.         |
| `preview`       | Serve the production build locally to preview it.        |
| `lint`          | Check the code for problems with ESLint.                 |
| `lint:fix`      | Automatically fix the ESLint problems it can.            |
| `format`        | Format the whole codebase with Prettier.                 |

---

## Project structure

```
location-based-service/
├── .github/workflows/    # Automated build & deploy to GitHub Pages
├── public/               # Static files served as-is (icons, favicon, PWA icons)
├── src/                  # Application source code
│   ├── main.jsx          # Entry point — mounts React, theming, and Framework7
│   ├── App.jsx           # App shell that wraps the map
│   ├── Map.jsx           # Core map: state, tile layers, markers, sheets, routing
│   ├── Map.css           # Map and UI styles
│   ├── PWAUpdatePrompt.jsx  # "New version available" notification
│   ├── components/       # UI building blocks (see below)
│   ├── services/         # API helpers that fetch data (see below)
│   └── assets/           # Images (marker, map-style thumbnails, logos)
├── index.html            # HTML shell that loads the app
├── vite.config.js        # Vite + PWA configuration
└── package.json          # Dependencies and the scripts listed above
```

**`src/components/`** holds the reusable pieces of the interface — for example `LocationInfoSheet.jsx` (the detail panel for a selected place), `RoutePlanningSheet.jsx` and `ElevationChart.jsx` (route planning and its elevation graph), `SearchControl.jsx`, and the POI filter/results sheets.

**`src/services/`** holds thin wrappers around the external APIs — for example `nominatim.js` (address search & lookup), `weather.js` and `airquality.js` (Open-Meteo), `wikipedia.js` / `wikidata.js` (place info), `elevationProfile.js` (route elevation), and `favourites.js` (saved places stored in the browser).

---

## Project roadmap & scrum board

We track our work using a **GitHub Project board** — a visual, Kanban-style board where every task is a card. If you've never used one, here's what it is and how to find it.

**What it is:** Each card on the board is a GitHub *issue* — a single task or feature (this README, for example, was task **#201**). Cards move across columns such as **To do → In progress → Done** so anyone can see what's planned, what's being worked on, and what's finished. The **Roadmap** view shows the same tasks on a timeline instead of columns, which is useful for seeing the bigger picture over time.

**How to find it (step by step):**

1. Open the repository on GitHub: <https://github.com/philippsnr/location-based-service>
2. Near the top of the page, in the row of tabs (Code, Issues, Pull requests, …), click **Projects**.
3. Click the project in the list to open the board. You'll see the columns with all the task cards.
4. Inside the project, use the view switcher (near the top of the board) to select the **Roadmap** view to see the tasks laid out on a timeline.
5. Click any card to open its issue and read the full description and discussion.

> Tip: the **Issues** tab (next to Projects) lists the same tasks as a plain list if you just want to browse or create one.

---

## Deployment

Every push to the `main` branch is automatically built and published to **GitHub Pages** by the GitHub Actions workflow in `.github/workflows/`. No manual deployment steps are required.
