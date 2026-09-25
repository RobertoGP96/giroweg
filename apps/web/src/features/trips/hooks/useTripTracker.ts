"use client";

import { useEffect } from "react";
import { GPS_THRESHOLDS } from "@giroweg/shared/tokens";
import { isGpsSimulationEnabled, startGpsSimulator } from "../gpsSimulator";
import { useTripStore } from "../store";
import type { GpsState } from "../tracking";

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: GPS_THRESHOLDS.watchMaximumAgeMs,
  timeout: GPS_THRESHOLDS.watchTimeoutMs,
};

const gpsStateForError = (error: GeolocationPositionError): GpsState => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "denied";
    case error.POSITION_UNAVAILABLE:
      return "unavailable";
    default:
      return "timeout";
  }
};

const feed = (position: GeolocationPosition) => {
  const { coords } = position;
  useTripStore.getState().addFix({
    lng: coords.longitude,
    lat: coords.latitude,
    t: position.timestamp,
    accuracy: coords.accuracy,
    speed: coords.speed,
  });
};

/**
 * Feeds device positions into the trip store while `enabled`. The watch is
 * restarted when the page becomes visible again because browsers throttle or
 * drop it in the background. Errors set the GPS status but keep watching.
 */
export const useTripTracker = (enabled: boolean): void => {
  useEffect(() => {
    if (!enabled) return;
    const setGps = (gps: GpsState) => useTripStore.getState().setGps(gps);

    if (isGpsSimulationEnabled()) {
      setGps("searching");
      return startGpsSimulator((fix) => useTripStore.getState().addFix(fix));
    }

    if (!("geolocation" in navigator)) {
      setGps("unavailable");
      return;
    }

    let watchId: number | null = null;
    const startWatch = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      setGps("searching");
      watchId = navigator.geolocation.watchPosition(
        feed,
        (error) => setGps(gpsStateForError(error)),
        WATCH_OPTIONS,
      );
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") startWatch();
    };

    startWatch();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled]);
};
