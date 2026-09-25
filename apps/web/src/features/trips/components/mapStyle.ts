/**
 * Map styling from the design tokens: tile styles per theme, the blank
 * fallback when tiles cannot load, and the route layers drawn on top.
 */

import { routePointToGeo, type RoutePoint } from "@giroweg/shared/domain";
import { colors, type ThemeName } from "@giroweg/shared/tokens";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

export const MAP_STYLE_URLS: Record<ThemeName, string> = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/liberty",
};

export const ROUTE_SOURCE = "route";
export const ROUTE_ENDS_SOURCE = "route-ends";

const ROUTE_CASING_WIDTH = 9;
const ROUTE_LINE_WIDTH = 5;
const END_RADIUS = 7;
const END_STROKE_WIDTH = 3;

/** Plain background in the map colour of the theme: offline or tiles failed. */
export const blankStyle = (theme: ThemeName): StyleSpecification => ({
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": colors[theme].map },
    },
  ],
});

/** Casing + line for the route, start (hollow) and current (solid) markers. */
export const routeLayers = (theme: ThemeName): LayerSpecification[] => [
  {
    id: "route-casing",
    type: "line",
    source: ROUTE_SOURCE,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": colors[theme].bg, "line-width": ROUTE_CASING_WIDTH },
  },
  {
    id: "route-line",
    type: "line",
    source: ROUTE_SOURCE,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": colors[theme].lime, "line-width": ROUTE_LINE_WIDTH },
  },
  {
    id: "route-ends",
    type: "circle",
    source: ROUTE_ENDS_SOURCE,
    paint: {
      "circle-radius": END_RADIUS,
      "circle-color": [
        "case",
        ["==", ["get", "kind"], "start"],
        colors[theme].bg,
        colors[theme].lime,
      ],
      "circle-stroke-color": colors[theme].lime,
      "circle-stroke-width": END_STROKE_WIDTH,
    },
  },
];

type Segments = readonly (readonly RoutePoint[])[];

const toPosition = (point: RoutePoint): GeoJSON.Position => {
  const { lng, lat } = routePointToGeo(point);
  return [lng, lat];
};

export const routeFeature = (segments: Segments): GeoJSON.Feature<GeoJSON.MultiLineString> => ({
  type: "Feature",
  properties: {},
  geometry: {
    type: "MultiLineString",
    coordinates: segments
      .filter((segment) => segment.length >= 2)
      .map((segment) => segment.map(toPosition)),
  },
});

export interface RouteEndProperties {
  kind: "start" | "current";
}

const endFeature = (point: RoutePoint, kind: RouteEndProperties["kind"]): GeoJSON.Feature<GeoJSON.Point, RouteEndProperties> => ({
  type: "Feature",
  properties: { kind },
  geometry: { type: "Point", coordinates: toPosition(point) },
});

/** The first point of the route as "start" and the last one as "current". */
export const routeEndsFeatures = (
  segments: Segments,
): GeoJSON.FeatureCollection<GeoJSON.Point, RouteEndProperties> => {
  const populated = segments.filter((segment) => segment.length > 0);
  const first = populated[0]?.[0];
  const lastSegment = populated[populated.length - 1];
  const last = lastSegment?.[lastSegment.length - 1];
  const features: GeoJSON.Feature<GeoJSON.Point, RouteEndProperties>[] = [];
  if (first) features.push(endFeature(first, "start"));
  if (last && last !== first) features.push(endFeature(last, "current"));
  return { type: "FeatureCollection", features };
};

/** Last recorded position, for centring the live map. */
export const lastRoutePoint = (segments: Segments): RoutePoint | null => {
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i];
    const point = segment?.[segment.length - 1];
    if (point) return point;
  }
  return null;
};
