"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  type GeoJSONSource,
  type LngLatLike,
} from "maplibre-gl";
import { routeBounds, type RoutePoint } from "@giroweg/shared/domain";
import type { ThemeName } from "@giroweg/shared/tokens";
import { cn } from "@/lib/cn";
import { useTheme } from "@/theme/ThemeProvider";
import {
  MAP_STYLE_URLS,
  ROUTE_ENDS_SOURCE,
  ROUTE_SOURCE,
  blankStyle,
  lastRoutePoint,
  routeEndsFeatures,
  routeFeature,
  routeLayers,
} from "./mapStyle";

type Segments = readonly (readonly RoutePoint[])[];

export interface RouteMapCanvasProps {
  segments: Segments;
  /** live: follows the last point, not interactive. detail: fits the route, pannable. */
  mode: "live" | "detail";
  className?: string | undefined;
  /** Tiles could not be loaded (or loaded again): the map falls back to a blank canvas. */
  onTilesFailed?: ((failed: boolean) => void) | undefined;
}

const LIVE_ZOOM = 16;
const DETAIL_ZOOM = 13;
const FIT_PADDING = 40;
const FIT_MAX_ZOOM = 16;
const TILE_FADE_MS = 300;
const FOLLOW_MS = 500;
/** Minimum interval between live route redraws. */
const LIVE_REDRAW_MS = 1000;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const ORIGIN: LngLatLike = [0, 0];

const toLngLat = (point: RoutePoint): LngLatLike => [point[0], point[1]];

const prefersReducedMotion = (): boolean => window.matchMedia(REDUCED_MOTION_QUERY).matches;

/** Adds the route sources and layers to a freshly loaded style. */
const ensureRouteLayers = (map: MapLibreMap, theme: ThemeName, segments: Segments) => {
  if (!map.getSource(ROUTE_SOURCE)) {
    map.addSource(ROUTE_SOURCE, { type: "geojson", data: routeFeature(segments) });
  }
  if (!map.getSource(ROUTE_ENDS_SOURCE)) {
    map.addSource(ROUTE_ENDS_SOURCE, { type: "geojson", data: routeEndsFeatures(segments) });
  }
  for (const layer of routeLayers(theme)) {
    if (!map.getLayer(layer.id)) map.addLayer(layer);
  }
};

/**
 * MapLibre canvas drawing the trip route. Lives behind next/dynamic in
 * RouteMap (WebGL, browser only). If the WebGL context cannot be created the
 * constructor throws inside the mount effect and MapErrorBoundary shows the
 * fallback. Tile failures never throw: the map swaps to a blank style and
 * reports them through `onTilesFailed`.
 */
export default function RouteMapCanvas({ segments, mode, className, onTilesFailed }: RouteMapCanvasProps) {
  const { resolved: theme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  /** Latest props for the map event handlers, which outlive a render. */
  const segmentsRef = useRef(segments);
  const themeRef = useRef(theme);
  const onTilesFailedRef = useRef(onTilesFailed);
  /** True while the blank fallback style is applied. */
  const blankRef = useRef(false);
  const lastRedrawAtRef = useRef(0);
  const fittedBoundsRef = useRef<string | null>(null);
  /** Bumped on every style load so the data effect re-syncs after a style swap. */
  const [styleGeneration, setStyleGeneration] = useState(0);

  useEffect(() => {
    segmentsRef.current = segments;
    themeRef.current = theme;
    onTilesFailedRef.current = onTilesFailed;
  }, [segments, theme, onTilesFailed]);

  // Mount: one map per canvas, torn down on unmount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const initialTheme = themeRef.current;
    const online = navigator.onLine;
    const last = lastRoutePoint(segmentsRef.current);
    blankRef.current = !online;

    const map = new MapLibreMap({
      container,
      style: online ? MAP_STYLE_URLS[initialTheme] : blankStyle(initialTheme),
      center: last ? toLngLat(last) : ORIGIN,
      zoom: mode === "live" ? LIVE_ZOOM : DETAIL_ZOOM,
      interactive: mode === "detail",
      attributionControl: false,
      fadeDuration: prefersReducedMotion() ? 0 : TILE_FADE_MS,
    });
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");

    map.on("style.load", () => {
      ensureRouteLayers(map, themeRef.current, segmentsRef.current);
      fittedBoundsRef.current = null;
      setStyleGeneration((generation) => generation + 1);
    });

    map.on("error", () => {
      if (blankRef.current) return;
      blankRef.current = true;
      map.setStyle(blankStyle(themeRef.current));
      onTilesFailedRef.current?.(true);
    });

    const onOnline = () => {
      if (!blankRef.current) return;
      blankRef.current = false;
      map.setStyle(MAP_STYLE_URLS[themeRef.current]);
      onTilesFailedRef.current?.(false);
    };
    window.addEventListener("online", onOnline);

    mapRef.current = map;
    return () => {
      window.removeEventListener("online", onOnline);
      mapRef.current = null;
      map.remove();
    };
  }, [mode]);

  // Theme: swap the tile style (or the blank colour) when the theme changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(blankRef.current ? blankStyle(theme) : MAP_STYLE_URLS[theme]);
  }, [theme]);

  // Data: push the route into the sources and move the camera.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const redraw = () => {
      lastRedrawAtRef.current = Date.now();
      map.getSource<GeoJSONSource>(ROUTE_SOURCE)?.setData(routeFeature(segments));
      map.getSource<GeoJSONSource>(ROUTE_ENDS_SOURCE)?.setData(routeEndsFeatures(segments));

      if (mode === "live") {
        const last = lastRoutePoint(segments);
        if (last) map.easeTo({ center: toLngLat(last), duration: prefersReducedMotion() ? 0 : FOLLOW_MS });
        return;
      }
      const bounds = routeBounds(segments);
      if (!bounds) return;
      const key = `${bounds.sw.lng},${bounds.sw.lat},${bounds.ne.lng},${bounds.ne.lat}`;
      if (fittedBoundsRef.current === key) return;
      fittedBoundsRef.current = key;
      map.fitBounds(new LngLatBounds(bounds.sw, bounds.ne), {
        padding: FIT_PADDING,
        maxZoom: FIT_MAX_ZOOM,
        animate: false,
      });
    };

    const wait = mode === "live" ? LIVE_REDRAW_MS - (Date.now() - lastRedrawAtRef.current) : 0;
    if (wait <= 0) {
      redraw();
      return;
    }
    const timer = window.setTimeout(redraw, wait);
    return () => window.clearTimeout(timer);
  }, [segments, mode, styleGeneration]);

  return <div ref={containerRef} aria-hidden className={cn("size-full", className)} />;
}
