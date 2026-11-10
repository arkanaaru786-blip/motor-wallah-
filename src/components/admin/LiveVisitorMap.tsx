import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { MapPin, Radio, RefreshCw } from "lucide-react";

import { loadLiveVisitorFeed, type LiveVisitorFeed } from "@/lib/live-visitors";

const POLL_MS = 20_000;

/**
 * Phase 3B — real-time visitor map.
 *
 * Leaflet + OpenStreetMap tiles are both free and key-less; no paid maps API.
 * Dots come from `visitor_sessions` (city captured at session start) and refresh
 * every 20 seconds. With no traffic yet the feed returns clearly labelled
 * sample pins so the panel still demonstrates live behaviour.
 */
export function LiveVisitorMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const fittedRef = useRef(false);
  const [feed, setFeed] = useState<LiveVisitorFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // Create the map once, client-side only.
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    void (async () => {
      const leaflet = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;
      map = leaflet.map(containerRef.current, {
        center: [22.6, 79.4],
        zoom: 4,
        minZoom: 3,
        maxZoom: 12,
        scrollWheelZoom: false,
      });
      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        })
        .addTo(map);
      mapRef.current = map;
      layerRef.current = leaflet.layerGroup().addTo(map);
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      map?.remove();
      map = null;
      mapRef.current = null;
      layerRef.current = null;
      setMapReady(false);
      fittedRef.current = false;
    };
  }, []);

  // Poll the visitor feed.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await loadLiveVisitorFeed();
        if (active) setFeed(next);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  // Redraw markers whenever the feed changes.
  useEffect(() => {
    if (!mapReady || !feed) return;
    let cancelled = false;

    void (async () => {
      const leaflet = (await import("leaflet")).default;
      const layer = layerRef.current;
      const map = mapRef.current;
      if (cancelled || !layer || !map) return;

      layer.clearLayers();

      for (const pin of feed.pins) {
        const icon = leaflet.divIcon({
          className: `mw-live-dot ${pin.live ? "is-live" : "is-recent"}${pin.demo ? " is-demo" : ""}`,
          html: "<span></span>",
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const marker = leaflet.marker([pin.lat, pin.lng], {
          icon,
          title: pin.city,
          riseOnHover: true,
        });

        const popup = document.createElement("div");
        popup.className = "mw-live-popup";
        const title = document.createElement("strong");
        title.textContent = pin.city;
        const meta = document.createElement("span");
        meta.textContent = `${pin.device} · ${pin.browser} · ${pin.source}`;
        const detail = document.createElement("span");
        const seen = pin.live ? "live now" : "earlier today";
        detail.textContent = `${pin.pages} page${pin.pages === 1 ? "" : "s"} · ${seen}${
          pin.demo ? " · sample" : ""
        }`;
        popup.append(title, meta, detail);
        marker.bindPopup(popup);
        marker.addTo(layer);
      }

      if (!fittedRef.current && feed.pins.length > 0) {
        fittedRef.current = true;
        const bounds = leaflet.latLngBounds(
          feed.pins.map((pin) => [pin.lat, pin.lng] as [number, number]),
        );
        map.fitBounds(bounds.pad(0.3), { maxZoom: 5, animate: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [feed, mapReady]);

  return (
    <section className="mw-adv-panel mw-live-panel" aria-labelledby="live-visitors-title">
      <header className="mw-adv-panel-header">
        <div>
          <p className="mw-adv-panel-title" id="live-visitors-title">
            <MapPin size={16} /> Real-time live visitor map
          </p>
          <p className="mw-adv-panel-sub">
            City dots from visitor sessions · Leaflet + OpenStreetMap (free, no API key) · refreshes
            every 20s
          </p>
        </div>
        <div className="mw-live-status">
          {feed?.demo ? (
            <span className="mw-adv-pill">
              <MapPin size={14} /> Sample locations
            </span>
          ) : (
            <span className="mw-adv-pill">
              <Radio size={14} /> {feed?.liveCount ?? 0} live now
            </span>
          )}
          <span className="mw-live-updated">
            <RefreshCw size={12} /> {loading && !feed ? "Loading…" : "Auto-refresh"}
          </span>
        </div>
      </header>

      <div ref={containerRef} className="mw-live-map-canvas" aria-label="Live visitor map" />

      <footer className="mw-live-legend">
        <span>
          <i className="mw-live-legend-dot is-live" /> Live (last 5 min)
        </span>
        <span>
          <i className="mw-live-legend-dot is-recent" /> Earlier today
        </span>
        {feed?.unresolved ? <span>{feed.unresolved} visit(s) without a resolved city</span> : null}
        <span className="mw-live-note">{feed?.note}</span>
      </footer>
    </section>
  );
}
