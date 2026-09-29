import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useStore } from "../store/useStore";
import { api } from "../api/client";
import LayerControls from "./LayerControls";

// High-contrast, visibly distinct 4-level color scheme
const DISTRICT_SEVERITY_STYLES = {
  normal: {
    name: "Normal",
    fill: "#0284c7", // Sky Blue
    fillOpacity: 0.14,
    line: "#38bdf8",
    lineOpacity: 0.65,
    lineWidth: 1.2,
    badgeBg: "rgba(2, 132, 199, 0.2)",
    badgeBorder: "#0284c7",
    textColor: "#38bdf8",
    indicatorDot: "#38bdf8",
  },
  watch: {
    name: "Watch (Advisory)",
    fill: "#facc15", // Electric Lemon / Bright Canary Yellow (High luminance, pure yellow)
    fillOpacity: 0.35,
    line: "#fde047",
    lineOpacity: 0.9,
    lineWidth: 2.0,
    badgeBg: "rgba(250, 204, 21, 0.25)",
    badgeBorder: "#facc15",
    textColor: "#facc15",
    indicatorDot: "#facc15",
  },
  warning: {
    name: "Warning (High)",
    fill: "#ea580c", // Deep Tangelo Orange / Vivid Red-Orange (Clearly distinct from yellow)
    fillOpacity: 0.42,
    line: "#f97316",
    lineOpacity: 0.95,
    lineWidth: 2.2,
    badgeBg: "rgba(234, 88, 12, 0.25)",
    badgeBorder: "#ea580c",
    textColor: "#fb923c",
    indicatorDot: "#f97316",
  },
  severe: {
    name: "Severe (Emergency)",
    fill: "#e11d48", // Crimson Neon Red (Emergency danger)
    fillOpacity: 0.50,
    line: "#f43f5e",
    lineOpacity: 1.0,
    lineWidth: 2.5,
    badgeBg: "rgba(225, 29, 72, 0.3)",
    badgeBorder: "#e11d48",
    textColor: "#fda4af",
    indicatorDot: "#f43f5e",
  },
};

export default function MapView() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [districtsLoaded, setDistrictsLoaded] = useState(false);
  const markersRef = useRef([]);
  const currentSeveritiesRef = useRef({});

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
                "fill-color": DISTRICT_SEVERITY_STYLES.normal.fill,
                "fill-opacity": DISTRICT_SEVERITY_STYLES.normal.fillOpacity,
              },
            });

            mapInstance.addLayer({
              id: "districts-line",
              type: "line",
              source: "districts-source",
              paint: {
                "line-color": DISTRICT_SEVERITY_STYLES.normal.line,
                "line-width": 1.5,
                "line-opacity": DISTRICT_SEVERITY_STYLES.normal.lineOpacity,
                "line-dasharray": [2, 1],
              },
            });

            setDistrictsLoaded(true);

            // Hover tooltip on districts showing district name & active threat level
            const popup = new maplibregl.Popup({
              closeButton: false,
              closeOnClick: false,
            });

            mapInstance.on("mousemove", "districts-fill", (e) => {
              mapInstance.getCanvas().style.cursor = "pointer";
              if (e.features && e.features.length > 0) {
                const props = e.features[0].properties;
                const distId = props.id || props.district_id;
                const sev = currentSeveritiesRef.current[distId] || "normal";
                const sevStyle =
                  DISTRICT_SEVERITY_STYLES[sev] ||
                  DISTRICT_SEVERITY_STYLES.normal;

                popup
                  .setLngLat(e.lngLat)
                  .setHTML(
                    `<div style="font-family: system-ui, -apple-system, sans-serif; font-size: 11px; min-width: 160px; padding: 2px;">
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-weight: 700; color: #ffffff; font-size: 12px;">${props.name_en} (${props.name_bn || ""})</span>
                      </div>
                      <div style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 4px; background: ${sevStyle.badgeBg}; border: 1px solid ${sevStyle.badgeBorder}; color: ${sevStyle.textColor}; font-weight: 700; font-size: 10px; text-transform: uppercase; margin-bottom: 6px;">
                        <span style="width: 6px; height: 6px; border-radius: 9999px; background: ${sevStyle.indicatorDot};"></span>
                        <span>${sevStyle.name}</span>
                      </div>
                      <div style="color: #94a3b8; font-size: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
                        Pop: ${(props.population / 1000000).toFixed(1)}M &bull; Farmland: ${Math.round(props.farmland_pct * 100)}%
                      </div>
                    </div>`
                  )
                  .addTo(mapInstance);
              }
            });

            mapInstance.on("mouseleave", "districts-fill", () => {
              mapInstance.getCanvas().style.cursor = "";
              popup.remove();
            });

            // Click district to open alert modal or zoom in
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

  // 2. Update District Colors dynamically based on forecast horizon (leadIndex)
  useEffect(() => {
    if (!map.current || !mapReady || !districtsLoaded) return;
    const m = map.current;
    if (!m.getSource("districts-source") || !m.getLayer("districts-fill")) return;

    try {
      const isNow = leadIndex === -1;
      const sevMap = isNow
        ? forecast?.district_severities?.now || {}
        : forecast?.district_severities?.leads?.[leadIndex] || {};

      const alertMap = { ...sevMap };
      // Fallback if district_severities is not yet populated
      if (Object.keys(alertMap).length === 0 && alerts && alerts.length > 0) {
        alerts.forEach((a) => {
          alertMap[a.district_id] = a.severity;
        });
      }

      currentSeveritiesRef.current = alertMap;
      const entries = Object.entries(alertMap);

      if (entries.length === 0) {
        m.setPaintProperty(
          "districts-fill",
          "fill-color",
          DISTRICT_SEVERITY_STYLES.normal.fill,
        );
        m.setPaintProperty(
          "districts-fill",
          "fill-opacity",
          DISTRICT_SEVERITY_STYLES.normal.fillOpacity,
        );
        m.setPaintProperty(
          "districts-line",
          "line-color",
          DISTRICT_SEVERITY_STYLES.normal.line,
        );
        m.setPaintProperty(
          "districts-line",
          "line-opacity",
          DISTRICT_SEVERITY_STYLES.normal.lineOpacity,
        );
        return;
      }

      const fillColorExpr = [
        "match",
        ["coalesce", ["get", "id"], ["get", "district_id"], ""],
      ];
      const fillOpacityExpr = [
        "match",
        ["coalesce", ["get", "id"], ["get", "district_id"], ""],
      ];
      const lineColorExpr = [
        "match",
        ["coalesce", ["get", "id"], ["get", "district_id"], ""],
      ];
      const lineOpacityExpr = [
        "match",
        ["coalesce", ["get", "id"], ["get", "district_id"], ""],
      ];

      entries.forEach(([distId, sev]) => {
        const conf =
          DISTRICT_SEVERITY_STYLES[sev] || DISTRICT_SEVERITY_STYLES.normal;
        fillColorExpr.push(distId, conf.fill);
        fillOpacityExpr.push(distId, conf.fillOpacity);
        lineColorExpr.push(distId, conf.line);
        lineOpacityExpr.push(distId, conf.lineOpacity);
      });

      fillColorExpr.push(DISTRICT_SEVERITY_STYLES.normal.fill);
      fillOpacityExpr.push(DISTRICT_SEVERITY_STYLES.normal.fillOpacity);
      lineColorExpr.push(DISTRICT_SEVERITY_STYLES.normal.line);
      lineOpacityExpr.push(DISTRICT_SEVERITY_STYLES.normal.lineOpacity);

      m.setPaintProperty("districts-fill", "fill-color", fillColorExpr);
      m.setPaintProperty("districts-fill", "fill-opacity", fillOpacityExpr);
      m.setPaintProperty("districts-line", "line-color", lineColorExpr);
      m.setPaintProperty("districts-line", "line-opacity", lineOpacityExpr);
    } catch (e) {
      console.warn("District paint update error:", e);
    }
  }, [forecast, leadIndex, alerts, mapReady, districtsLoaded]);

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
      if (!m) return;

      const layerExists = Boolean(m.getLayer(layerId));

      // If toggled off or no image URL, immediately ensure layer is hidden
      if (!visible || !url) {
        if (layerExists) {
          try {
            m.setLayoutProperty(layerId, "visibility", "none");
            m.setPaintProperty(layerId, "raster-opacity", 0);
          } catch (e) {}
        }
        return;
      }

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
          m.setLayoutProperty(layerId, "visibility", "visible");
          m.setPaintProperty(layerId, "raster-opacity", opacity);
        }
      } catch (err) {
        console.warn(`Layer update for ${layerId} pending:`, err);
      }
    };

    // 1. Radar Now (T0 - Baseline observed Doppler radar)
    updateOrAddImageLayer(
      "vil-now-src",
      "vil-now-layer",
      vilNowUrl,
      overlayOpacity * 0.9,
      Boolean(layerVisibility.radarNow),
      "districts-line",
    );

    // 2. Predicted Radar (AI-predicted convective cloud reflectivity)
    updateOrAddImageLayer(
      "vil-pred-src",
      "vil-pred-layer",
      vilPredUrl,
      overlayOpacity,
      Boolean(layerVisibility.predictedRadar),
      "districts-line",
    );

    // 3. Actual Truth Radar (for AI verification)
    updateOrAddImageLayer(
      "vil-actual-src",
      "vil-actual-layer",
      vilActualUrl,
      overlayOpacity,
      Boolean(layerVisibility.actualRadar),
      "districts-line",
    );

    // 4. Lightning Risk Overlay (Projected strike risk heatmap)
    updateOrAddImageLayer(
      "lght-src",
      "lght-layer",
      lghtUrl,
      overlayOpacity * 0.95,
      Boolean(layerVisibility.lightningRisk),
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
      : forecast.storm_cells_by_lead?.[leadIndex] ||
        forecast.storm_cells ||
        [];

    currentCells.forEach((cell) => {
      const isVerySevere = cell.max_vil >= 0.75;
      const borderColor = isVerySevere ? "#f43f5e" : "#f59e0b";
      const textColor = isVerySevere ? "#fda4af" : "#fde68a";
      const heading = Number.isFinite(cell.heading_deg)
        ? cell.heading_deg
        : 52;

      const el = document.createElement("div");
      el.className = "storm-cell-marker";
      el.style.cssText =
        "width: 36px; height: 36px; cursor: pointer; position: relative; display: flex; align-items: center; justify-content: center; user-select: none;";

      el.innerHTML = `
        <div class="marker-icon" style="transform: rotate(${heading}deg); width: 32px; height: 32px; border-radius: 9999px; background: rgba(8, 13, 26, 0.95); border: 2px solid ${borderColor}; box-shadow: 0 4px 12px rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; color: ${textColor}; transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;">
          <svg style="width: 15px; height: 15px; fill: currentColor;" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
        </div>
        <div class="cell-label" style="display: none; position: absolute; bottom: 38px; left: 50%; transform: translateX(-50%); background: #0f172a; color: #f8fafc; font-size: 10px; font-family: monospace; padding: 3px 7px; border-radius: 4px; white-space: nowrap; border: 1px solid #334155; pointer-events: none; z-index: 50; box-shadow: 0 4px 12px rgba(0,0,0,0.6);">
          ${cell.id}: VIL ${cell.max_vil} | ${cell.motion_kmh}km/h | ${Math.round(heading)}°
        </div>
      `;

      const iconEl = el.querySelector(".marker-icon");
      const tooltip = el.querySelector(".cell-label");

      el.addEventListener("mouseenter", () => {
        if (tooltip) tooltip.style.display = "block";
        if (iconEl) {
          iconEl.style.transform = `rotate(${heading}deg) scale(1.22)`;
          iconEl.style.boxShadow = `0 0 16px ${borderColor}`;
        }
      });
      el.addEventListener("mouseleave", () => {
        if (tooltip) tooltip.style.display = "none";
        if (iconEl) {
          iconEl.style.transform = `rotate(${heading}deg) scale(1)`;
          iconEl.style.boxShadow = "0 4px 12px rgba(0,0,0,0.6)";
        }
      });

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

      const marker = new maplibregl.Marker({
        element: el,
        anchor: "center",
      })
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

      {/* Floating Radar, Lightning & District Warning Colormap Legends (Bottom Right) */}
      <div className="absolute bottom-6 right-4 z-10 glass-panel rounded-xl p-3 border border-slate-800 text-[10px] space-y-2.5 shadow-xl select-none w-64">
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

        {/* 4 Distinct Warning Levels Legend */}
        <div className="pt-1 border-t border-slate-800/70">
          <div className="text-slate-300 font-semibold mb-1.5 flex justify-between">
            <span>District Warning Level</span>
            <span className="font-mono text-slate-400">IMD Alert</span>
          </div>
          <div className="grid grid-cols-4 gap-1 text-center font-semibold text-[9px]">
            <div
              className="flex items-center justify-center gap-1 bg-sky-950/40 border border-sky-600/50 rounded px-1 py-1 text-sky-300 shadow-sm"
              title="Normal - Calm, no severe thunderstorm activity"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />
              <span>Normal</span>
            </div>
            <div
              className="flex items-center justify-center gap-1 bg-yellow-950/40 border border-yellow-400/70 rounded px-1 py-1 text-yellow-300 shadow-sm"
              title="Watch - Be Updated (Bright Lemon Yellow)"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
              <span>Watch</span>
            </div>
            <div
              className="flex items-center justify-center gap-1 bg-orange-950/40 border border-orange-600/80 rounded px-1 py-1 text-orange-300 shadow-sm"
              title="Warning - Be Prepared (Deep Tangelo Orange)"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
              <span>Warning</span>
            </div>
            <div
              className="flex items-center justify-center gap-1 bg-rose-950/40 border border-rose-600/80 rounded px-1 py-1 text-rose-300 shadow-sm"
              title="Severe - Take Action (Crimson Neon Red)"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0 animate-pulse" />
              <span>Severe</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
