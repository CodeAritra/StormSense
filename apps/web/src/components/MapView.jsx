import React, { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useStore } from "../store/useStore";
import { api } from "../api/client";
import LayerControls from "./LayerControls";

export default function MapView() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const markersRef = useRef([]);

  const {
    forecast,
    leadIndex,
    layerVisibility,
    overlayOpacity,
    compareWithActual,
    compareBlend,
    alerts,
    flyToLocation,
    setFlyToLocation,
    setActiveModalAlert,
    setSelectedStormCell,
  } = useStore();

  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;

  const bounds = forecast?.bounds || {
    west: 86.6,
    south: 20.85,
    east: 90.1,
    north: 24.29,
  };

  // MapLibre coordinates order: [[west, north], [east, north], [east, south], [west, south]]
  const imageCoordinates = [
    [bounds.west, bounds.north],
    [bounds.east, bounds.north],
    [bounds.east, bounds.south],
    [bounds.west, bounds.south],
  ];

  // 1. Initialize MapLibre GL Map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    // Dark base style that works reliably across all browsers
    const reliableDarkStyle = {
      version: 8,
      sources: {
        "osm-tiles": {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "&copy; OpenStreetMap contributors",
        },
      },
      layers: [
        {
          id: "background-color",
          type: "background",
          paint: {
            "background-color": "#080d1a",
          },
        },
        {
          id: "osm-tiles-layer",
          type: "raster",
          source: "osm-tiles",
          minzoom: 0,
          maxzoom: 19,
          paint: {
            "raster-brightness-max": 0.5,
            "raster-saturation": -0.9,
            "raster-contrast": 0.35,
            "raster-opacity": 0.85,
          },
        },
      ],
    };

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: reliableDarkStyle,
      center: [88.36, 22.57], // Kolkata center
      zoom: 7.5,
      pitch: 0,
      attributionControl: false,
    });

    mapInstance.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      "top-right",
    );

    const markReady = () => {
      setMapReady(true);
      mapInstance.resize();

      // Load districts GeoJSON
      api
        .getDistricts()
        .then((districtsGeo) => {
          if (!mapInstance.getSource("districts-source")) {
            mapInstance.addSource("districts-source", {
              type: "geojson",
              data: districtsGeo,
            });

            mapInstance.addLayer({
              id: "districts-fill",
              type: "fill",
              source: "districts-source",
              paint: {
                "fill-color": "#06b6d4",
                "fill-opacity": 0.15,
              },
            });

            mapInstance.addLayer({
              id: "districts-line",
              type: "line",
              source: "districts-source",
              paint: {
                "line-color": "#38bdf8",
                "line-width": 1.5,
                "line-opacity": 0.7,
                "line-dasharray": [2, 1],
              },
            });

            // Hover tooltip on districts
            const popup = new maplibregl.Popup({
              closeButton: false,
              closeOnClick: false,
            });

            mapInstance.on("mousemove", "districts-fill", (e) => {
              mapInstance.getCanvas().style.cursor = "pointer";
              if (e.features && e.features.length > 0) {
                const props = e.features[0].properties;
                popup
                  .setLngLat(e.lngLat)
                  .setHTML(
                    `<div class="text-xs">
                      <div class="font-bold text-white">${props.name_en} (${props.name_bn || ""})</div>
                      <div class="text-[11px] text-slate-300">Pop: ${(props.population / 1000000).toFixed(1)}M | Farmland: ${Math.round(props.farmland_pct * 100)}%</div>
                    </div>`,
                  )
                  .addTo(mapInstance);
              }
            });

            mapInstance.on("mouseleave", "districts-fill", () => {
              mapInstance.getCanvas().style.cursor = "";
              popup.remove();
            });

            // Click district to open alert or zoom in
            mapInstance.on("click", "districts-fill", (e) => {
              if (e.features && e.features.length > 0) {
                const props = e.features[0].properties;
                const distId = props.id || props.district_id;
                const matchingAlert = alertsRef.current.find(
                  (a) => a.district_id === distId,
                );
                if (matchingAlert) {
                  setActiveModalAlert(matchingAlert);
                } else {
                  mapInstance.flyTo({
                    center: e.lngLat,
                    zoom: 8.5,
                    essential: true,
                  });
                }
              }
            });
          }
        })
        .catch((err) => console.error("Districts GeoJSON load error:", err));
    };

    mapInstance.once("load", markReady);
    mapInstance.once("styledata", markReady);

    // Safety fallback to guarantee ready state
    const safetyTimer = setTimeout(() => {
      markReady();
    }, 500);

    const resizeTimer = setTimeout(() => {
      mapInstance.resize();
    }, 250);

    const handleWindowResize = () => mapInstance.resize();
    window.addEventListener("resize", handleWindowResize);

    map.current = mapInstance;

    return () => {
      clearTimeout(safetyTimer);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleWindowResize);
      mapInstance.remove();
      map.current = null;
    };
  }, []);

  // 2. Update District Colors based on current alert severities
  useEffect(() => {
    if (!map.current || !mapReady || !map.current.getSource("districts-source"))
      return;

    try {
      if (alerts && alerts.length > 0) {
        const alertMap = {};
        alerts.forEach((a) => {
          alertMap[a.district_id] = a.severity;
        });

        const colorCases = ["case"];
        const opacityCases = ["case"];

        Object.entries(alertMap).forEach(([distId, sev]) => {
          colorCases.push(["==", ["get", "id"], distId]);
          if (sev === "severe")
            colorCases.push("#f43f5e"); // crimson
          else if (sev === "warning")
            colorCases.push("#f59e0b"); // amber
          else colorCases.push("#eab308"); // yellow

          opacityCases.push(["==", ["get", "id"], distId]);
          opacityCases.push(0.35);
        });

        colorCases.push("#06b6d4"); // fallback
        opacityCases.push(0.12);

        map.current.setPaintProperty(
          "districts-fill",
          "fill-color",
          colorCases,
        );
        map.current.setPaintProperty(
          "districts-fill",
          "fill-opacity",
          opacityCases,
        );
      } else {
        map.current.setPaintProperty("districts-fill", "fill-color", "#06b6d4");
        map.current.setPaintProperty("districts-fill", "fill-opacity", 0.12);
      }
    } catch (e) {
      // Style may be transitioning
    }
  }, [alerts, mapReady]);

  // 3. Update Raster Overlays (Radar Now, Predicted Radar, Lightning, Actual Truth)
  useEffect(() => {
    if (!map.current || !mapReady || !forecast) return;

    const m = map.current;
    const isNow = leadIndex === -1;
    const effectiveLead = isNow ? 0 : leadIndex;

    const vilPredUrl = forecast.overlays?.vil_pred?.[effectiveLead];
    const lghtUrl = forecast.overlays?.lightning?.[effectiveLead];
    const vilActualUrl = forecast.overlays?.vil_actual?.[effectiveLead];
    const vilNowUrl = forecast.overlays?.vil_now;

    const updateOrAddImageLayer = (
      sourceId,
      layerId,
      url,
      opacity,
      visible,
      beforeLayerId,
    ) => {
      if (!url || !m) return;
      const fullUrl = api.getOverlayUrl(url);

      try {
        const src = m.getSource(sourceId);
        if (src) {
          src.updateImage({
            url: fullUrl,
            coordinates: imageCoordinates,
          });
        } else {
          m.addSource(sourceId, {
            type: "image",
            url: fullUrl,
            coordinates: imageCoordinates,
          });

          const before =
            beforeLayerId && m.getLayer(beforeLayerId)
              ? beforeLayerId
              : undefined;
          m.addLayer(
            {
              id: layerId,
              type: "raster",
              source: sourceId,
              paint: {
                "raster-opacity": opacity,
                "raster-resampling": "linear",
                "raster-fade-duration": 0,
              },
            },
            before,
          );
        }

        if (m.getLayer(layerId)) {
          m.setLayoutProperty(
            layerId,
            "visibility",
            visible ? "visible" : "none",
          );
          m.setPaintProperty(layerId, "raster-opacity", opacity);
        }
      } catch (err) {
        console.warn(`Layer update for ${layerId} pending:`, err);
      }
    };

    // Calculate opacities with comparison crossfade
    let predOpacity = overlayOpacity;
    let actualOpacity = overlayOpacity;

    if (compareWithActual) {
      predOpacity = overlayOpacity * (1.0 - compareBlend);
      actualOpacity = overlayOpacity * compareBlend;
    }

    // 1. Radar Now (T0)
    updateOrAddImageLayer(
      "vil-now-src",
      "vil-now-layer",
      vilNowUrl,
      overlayOpacity * 0.9,
      isNow
        ? layerVisibility.radarNow
        : layerVisibility.radarNow && !layerVisibility.predictedRadar,
      "districts-line",
    );

    // 2. Predicted Radar (+5 to +60 min)
    updateOrAddImageLayer(
      "vil-pred-src",
      "vil-pred-layer",
      vilPredUrl,
      predOpacity,
      !isNow && layerVisibility.predictedRadar,
      "districts-line",
    );

    // 3. Actual Truth Radar (for verification)
    updateOrAddImageLayer(
      "vil-actual-src",
      "vil-actual-layer",
      vilActualUrl,
      actualOpacity,
      layerVisibility.actualRadar || compareWithActual,
      "districts-line",
    );

    // 4. Lightning Risk Overlay
    updateOrAddImageLayer(
      "lght-src",
      "lght-layer",
      lghtUrl,
      overlayOpacity * 0.95,
      layerVisibility.lightningRisk,
      "districts-line",
    );

    // Districts visibility
    if (m.getLayer("districts-fill") && m.getLayer("districts-line")) {
      const distVis = layerVisibility.districts ? "visible" : "none";
      m.setLayoutProperty("districts-fill", "visibility", distVis);
      m.setLayoutProperty("districts-line", "visibility", distVis);
    }
  }, [
    forecast,
    leadIndex,
    layerVisibility,
    overlayOpacity,
    compareWithActual,
    compareBlend,
    mapReady,
  ]);

  // 4. Storm Cell Markers (Dynamically updates with forecast horizon)
  useEffect(() => {
    if (!map.current || !mapReady) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!layerVisibility.stormCells || !forecast) return;

    const isNow = leadIndex === -1;
    const currentCells = isNow
      ? forecast.storm_cells_now || forecast.storm_cells || []
      : forecast.storm_cells_by_lead?.[leadIndex] || forecast.storm_cells || [];

    currentCells.forEach((cell) => {
      const el = document.createElement("div");
      el.className = "storm-marker group cursor-pointer";
      const isVerySevere = cell.max_vil >= 0.75;
      const borderColor = isVerySevere
        ? "border-rose-500 text-rose-400"
        : "border-amber-500 text-amber-400";

      el.innerHTML = `
        <div style="transform: rotate(${cell.heading_deg}deg);" class="w-8 h-8 rounded-full bg-slate-900/90 border-2 ${borderColor} shadow-lg flex items-center justify-center font-bold transition-transform duration-300 hover:scale-125">
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
        </div>
        <div class="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-mono px-2 py-0.5 rounded shadow whitespace-nowrap border border-slate-700 pointer-events-none z-50">
          ${cell.id}: VIL ${cell.max_vil} | ${cell.motion_kmh}km/h | ${cell.heading_deg}°
        </div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedStormCell(cell);
        if (map.current) {
          map.current.flyTo({
            center: [cell.lon, cell.lat],
            zoom: 9.5,
            essential: true,
          });
        }
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([cell.lon, cell.lat])
        .addTo(map.current);

      markersRef.current.push(marker);
    });
  }, [
    forecast,
    leadIndex,
    layerVisibility.stormCells,
    mapReady,
    setSelectedStormCell,
  ]);

  // 5. Smooth flyTo navigation
  useEffect(() => {
    if (!map.current || !flyToLocation) return;
    map.current.flyTo({
      center: flyToLocation.center,
      zoom: flyToLocation.zoom || 9,
      essential: true,
      duration: 1200,
    });
    setFlyToLocation(null);
  }, [flyToLocation, setFlyToLocation]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      {/* MapLibre Canvas Container */}
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {/* Floating Layer Controls (Top Left) */}
      <div className="absolute top-4 left-4 z-10">
        <LayerControls />
      </div>

      {/* Floating Radar & Lightning Colormap Legends (Bottom Right) */}
      <div className="absolute bottom-6 right-4 z-10 glass-panel rounded-xl p-3 border border-slate-800 text-[10px] space-y-2.5 shadow-xl select-none">
        <div>
          <div className="text-slate-300 font-semibold mb-1 flex justify-between">
            <span>Radar Storm Intensity (VIL)</span>
            <span className="font-mono text-slate-400">kg/m²</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-slate-400">0.1</span>
            <div
              className="h-2.5 rounded flex-1"
              style={{
                background:
                  "linear-gradient(to right, #1ec832, #fae614, #ff8200, #eb1919, #d200dc)",
              }}
            />
            <span className="text-[9px] text-slate-400">&ge;0.8</span>
          </div>
        </div>

        <div>
          <div className="text-slate-300 font-semibold mb-1 flex justify-between">
            <span>Lightning Probability</span>
            <span className="font-mono text-slate-400">%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-slate-400">20%</span>
            <div
              className="h-2.5 rounded flex-1"
              style={{
                background:
                  "linear-gradient(to right, #fffa3c, #ff870f, #eb141e, #aa14f0)",
              }}
            />
            <span className="text-[9px] text-slate-400">&gt;85%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
