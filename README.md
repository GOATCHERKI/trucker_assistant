# Truck Route Assistant

### Smart Truck Route Safety and Detour Planner

![License](https://img.shields.io/badge/license-ISC-green)
![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-Frontend-646CFF?logo=vite&logoColor=white)
![OSRM](https://img.shields.io/badge/Routing-OSRM-1f2937)
![OpenStreetMap](https://img.shields.io/badge/Maps-OpenStreetMap-7ebc6f)

Truck Tracker is a map-first route safety app for heavy vehicles. It calculates the fastest route with OSRM, checks nearby OpenStreetMap restrictions (`maxheight`, `maxweight`) through Overpass, and proposes safer detours when violations are detected.

## Why This Project Matters 🚛

- Helps fleet teams avoid low bridges and overweight-restricted roads.
- Combines speed and safety in one decision workflow.
- Visualizes risky route segments directly on the map.
- Degrades gracefully when public Overpass endpoints are unstable.

## Key Highlights ✨

- Fastest + safe-alternative route comparison in a single response.
- Truck-aware validation for both height and weight limits.
- Interactive map input with warning-linked marker focus.
- Fallback-aware Overpass integration with cooldown handling.
- Modular full-stack JavaScript architecture.

## Tech Stack 🧰

- Frontend: React 19, Vite, React Leaflet, Leaflet, Tailwind CSS
- Backend: Node.js, Express, Axios
- Routing engine: OSRM (`router.project-osrm.org` by default)
- Restriction data: Overpass API (OpenStreetMap)

## Project Structure 🗂️

```text
truck-tracker/
  backend/
	 src/
		controllers/
		routes/
		services/
		utils/
  frontend/
	 src/
		components/
		services/
		utils/
```

## How It Works ⚙️

1. User selects start and destination points on the map and enters truck specs.
2. Backend fetches the fastest route from OSRM.
3. Backend queries Overpass using route bounding box for:
   - `maxheight`
   - `maxweight`
4. Safety service checks route segments for truck-limit violations.
5. If violations exist, backend attempts waypoint-based detours and returns:
   - `routes.fastest`
   - `routes.safe` (if viable)
   - safety warnings and unsafe points

## Prerequisites 📌

- Node.js 18+
- npm 9+

## Future Improvements 🚀

- Add caching for repeated bbox/constraint queries.
- Introduce endpoint health scoring and circuit-breaker logic.
- Persist route history and fleet truck profiles.
- Expand service-level unit and integration tests.

## License 📄

ISC

Made with ❤️ by Mohamed Zakaria Cherki
