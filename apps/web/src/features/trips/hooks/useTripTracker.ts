"use client";

import { useEffect, useRef } from "react";
import { haversineKm, isPlausibleStep, type LatLng } from "../gps";
import { useShiftStore } from "../store";

const SIMULATED_STEP_KM = 0.07;
const SIMULATED_SPEED_KMH = 28;

/**
 * Keeps the shift clock running and feeds GPS distance into the store while
 * a trip is active. Uses the Geolocation API; when it is unavailable or
 * denied (desktop preview) it falls back to a simulated route so the flow
 * can still be exercised.
 */
export const useTripTracker = (active: boolean): void => {
  const tick = useShiftStore((s) => s.tick);
  const addDistance = useShiftStore((s) => s.addDistance);
  const lastPosition = useRef<{ point: LatLng; at: number } | null>(null);

  useEffect(() => {
    if (!active) return;
    const clock = window.setInterval(tick, 1_000);
    return () => window.clearInterval(clock);
  }, [active, tick]);

  useEffect(() => {
    if (!active) return;

    let simulation: number | undefined;
    const simulate = () => {
      simulation = window.setInterval(() => {
        const jitter = (Math.random() - 0.5) * 0.02;
        addDistance(SIMULATED_STEP_KM + jitter, SIMULATED_SPEED_KMH + Math.round(jitter * 200));
      }, 1_000);
    };

    if (!("geolocation" in navigator)) {
      simulate();
      return () => window.clearInterval(simulation);
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        const at = position.timestamp;
        const previous = lastPosition.current;
        lastPosition.current = { point, at };
        if (!previous) return;
        const km = haversineKm(previous.point, point);
        if (!isPlausibleStep(km)) return;
        const hours = Math.max(at - previous.at, 1) / 3_600_000;
        addDistance(km, Math.round(km / hours));
      },
      () => {
        if (simulation === undefined) simulate();
      },
      { enableHighAccuracy: true, maximumAge: 2_000, timeout: 10_000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (simulation !== undefined) window.clearInterval(simulation);
      lastPosition.current = null;
    };
  }, [active, addDistance]);
};
