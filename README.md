# 📍 Meet Halfway

Every time you want to meet a friend or family member who lives in another area, someone ends up driving much further. **Meet Halfway** finds the middle point between two areas in Kuwait and shows cafes or restaurants near it, ranked by how fair they are for both people.

## Features
* Pick the **governorate**, then the **area**, for each person (Arabic and English names)
* Swap button to switch Person A and Person B
* Calculates the midpoint and draws a search radius around it (adjustable 1 to 5 km)
* Finds cafes, restaurants, fast food or ice cream shops near the middle
* Ranks places by fairness (smallest difference in distance between both people), with a visual bar showing each person's share of the trip
* Click a place to zoom to it on the map, or open **Google Maps directions**
* Animated trips: both routes draw on the map and meet at the middle
* Full-screen night map with a floating panel, works on phone and desktop

## Tech
* **HTML, CSS, JavaScript** (no framework)
* **[Leaflet](https://leafletjs.com/reference.html)** for the interactive map
* **[Nominatim API](https://nominatim.org/release-docs/latest/api/Search/)** for geocoding (area name to coordinates)
* **[Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)** to query places from OpenStreetMap
* **[CARTO Basemaps](https://carto.com/basemaps)** for the map (free API key)
* **[Esri basemap tiles](https://www.esri.com)** as a backup map if CARTO fails or has no key
* **Haversine formula** to calculate distances

## API key setup
The map uses a free CARTO key. Keys are kept out of GitHub:

1. Get a free key at https://carto.com/basemaps/apikey
2. Copy `config.example.js` and rename the copy to `config.js`
3. Put your key in `config.js`

`config.js` is listed in `.gitignore`, so it is never uploaded. If there is no key, or CARTO stops working, the app switches to a free backup map automatically.

## Project structure
```
meet-halfway/
├── index.html   page layout
├── style.css    design
├── config.example.js   template for your API key
├── areas.js     Kuwait governorates and areas (Arabic + English)
├── app.js       map, API calls and logic
└── README.md
```

## Run it
Open `index.html` in your browser, or serve the folder:

```bash
npx serve .
# or
python -m http.server 8000
```

## What I learned
* Geocoding and how to respect an API usage policy (Nominatim allows 1 request per second), plus caching results
* Writing Overpass QL queries to search OpenStreetMap data
* Working with maps, custom markers, layers and popups in Leaflet
* Dependent dropdowns (governorate → area) driven by a data file
* Calculating real distances between coordinates with the Haversine formula

## Next steps
* Use the [OSRM API](https://project-osrm.org/docs/v5.24.0/api/) to compare real **driving time** instead of straight-line distance
* Support more than two people (group midpoint)

## Screenshot
<img width="1902" height="865" alt="image" src="https://github.com/user-attachments/assets/74f03e3b-ede7-4df1-ab97-9a6fc6d07dbc" />
<img width="1897" height="772" alt="Screenshot 2026-11-23 173721" src="https://github.com/user-attachments/assets/dcea1c79-4fa0-4079-95ae-94134a844440" />


---
Map data © OpenStreetMap contributors.
