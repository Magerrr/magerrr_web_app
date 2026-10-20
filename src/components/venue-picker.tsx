"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useId, useRef, useState } from "react";
import { roundCoord } from "@/lib/venue";
import { Button } from "./button";
import { toast } from "./toast";
import { inputBase } from "./ui";

export interface Point {
  lat: number;
  lng: number;
}

interface SearchResult {
  name: string;
  label: string;
  point: Point;
}

/** Tengah awal peta tanpa titik: Jakarta. */
const DEFAULT_CENTER: Point = { lat: -6.2, lng: 106.816 };

/** Cari lokasi lewat Nominatim (OpenStreetMap). Kebijakannya: maks 1 permintaan/detik, jadi hanya saat tombol Cari. */
async function searchPlaces(query: string): Promise<SearchResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ format: "jsonv2", limit: "5", countrycodes: "id", "accept-language": "id", q: query }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  const rows: { lat: string; lon: string; name?: string; display_name: string }[] = await response.json();
  return rows.map((r) => ({
    name: r.name || r.display_name.split(",")[0],
    label: r.display_name,
    point: { lat: roundCoord(Number(r.lat)), lng: roundCoord(Number(r.lon)) },
  }));
}

/**
 * Pilih titik tempat sesi di peta (MAGERRR-18): cari nama tempat, ketuk peta, seret pin, atau pakai lokasi perangkat.
 * Peta Leaflet + ubin OpenStreetMap, dimuat hanya saat dipakai. `onPickName` = nama hasil pencarian (mengisi nama
 * tempat bila masih kosong).
 */
export function VenuePicker({ value, onChange, onPickName }: { value: Point | null; onChange: (point: Point | null) => void; onPickName?: (name: string) => void }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const marker = useRef<Leaflet.Marker | null>(null);
  const lib = useRef<typeof Leaflet | null>(null);
  const change = useRef(onChange);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    change.current = onChange;
  }, [onChange]);

  // Peta dibuat sekali; titik awal = nilai yang sudah ada.
  const initial = useRef(value);
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !box.current) return;
      lib.current = L;
      const start = initial.current ?? DEFAULT_CENTER;
      const m = L.map(box.current, { center: [start.lat, start.lng], zoom: initial.current ? 16 : 11 });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      m.on("click", (e: Leaflet.LeafletMouseEvent) => {
        change.current({ lat: roundCoord(e.latlng.lat), lng: roundCoord(e.latlng.lng) });
      });
      map.current = m;
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  // Pin mengikuti nilai; bisa diseret.
  useEffect(() => {
    const L = lib.current;
    const m = map.current;
    if (!ready || !L || !m) return;
    if (!value) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      const icon = L.divIcon({
        className: "",
        html: '<span class="block size-7 rounded-full border-4 border-ink-black bg-coral-pop shadow-md"></span>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      marker.current = L.marker([value.lat, value.lng], { icon, draggable: true, keyboard: false, title: "Titik lokasi" }).addTo(m);
      marker.current.on("dragend", () => {
        const at = marker.current!.getLatLng();
        change.current({ lat: roundCoord(at.lat), lng: roundCoord(at.lng) });
      });
    } else {
      marker.current.setLatLng([value.lat, value.lng]);
    }
  }, [ready, value]);

  function flyTo(point: Point) {
    map.current?.setView([point.lat, point.lng], Math.max(map.current.getZoom(), 16));
  }

  async function search() {
    const q = query.trim();
    if (q.length < 3) return toast.error("Ketik minimal 3 huruf.");
    setSearching(true);
    try {
      const found = await searchPlaces(q);
      setResults(found);
      if (found.length === 0) toast.error("Tidak ditemukan. Coba nama lain, atau ketuk langsung di peta.");
    } catch {
      toast.error("Pencarian gagal. Periksa internet lalu coba lagi, atau ketuk langsung di peta.");
    }
    setSearching(false);
  }

  function pick(result: SearchResult) {
    onChange(result.point);
    onPickName?.(result.name);
    flyTo(result.point);
    setResults(null);
    toast(`Dipilih: ${result.label}`);
  }

  function locate() {
    if (!("geolocation" in navigator)) return toast.error("Perangkat ini tidak mendukung lokasi.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: roundCoord(pos.coords.latitude), lng: roundCoord(pos.coords.longitude) };
        onChange(point);
        flyTo(point);
        setLocating(false);
        toast("Titik diatur ke lokasimu sekarang.");
      },
      () => {
        setLocating(false);
        toast.error("Lokasi tidak bisa dibaca. Izinkan akses lokasi atau ketuk di peta.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="venue-picker">
      <div className="flex gap-2">
        <label htmlFor={`${id}-q`} className="sr-only">
          Cari lokasi
        </label>
        <input
          id={`${id}-q`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // Picker ada di dalam form sesi: Enter mencari, bukan menyimpan sesi.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Cari nama GOR atau alamat"
          maxLength={100}
          className={`${inputBase} min-w-0 flex-1`}
        />
        <Button variant="secondary" onClick={search} loading={searching} className="min-h-13">
          Cari
        </Button>
      </div>
      {results && results.length > 0 && (
        <ul className="flex flex-col divide-y divide-hairline-mist rounded-2xl border border-ink-black bg-pure-white" aria-label="Hasil pencarian lokasi">
          {results.map((r) => (
            <li key={`${r.point.lat},${r.point.lng}`}>
              <button type="button" onClick={() => pick(r)} className="flex min-h-11 w-full cursor-pointer flex-col px-4 py-2 text-left hover:bg-cream-paper">
                <span className="text-ui">{r.name}</span>
                <span className="line-clamp-2 text-caption">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* `isolate`: panel Leaflet ber-z-index tinggi tidak menimpa tombol simpan yang lengket. */}
      <div
        ref={box}
        role="application"
        aria-label="Peta: ketuk untuk menaruh pin, seret pin untuk memindah"
        className="isolate h-64 w-full overflow-hidden rounded-2xl border border-ink-black bg-sandstone sm:h-80"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={locate} loading={locating}>
          Pakai lokasiku
        </Button>
        {value && (
          <Button variant="secondary" onClick={() => onChange(null)}>
            Hapus pin
          </Button>
        )}
      </div>
      <p className="text-small" data-testid="venue-point">
        {value ? `Pin: ${value.lat}, ${value.lng}` : "Belum ada pin. Cari, ketuk peta, atau pakai lokasimu."}
      </p>
      <p className="text-caption">Peta &amp; pencarian: OpenStreetMap. Kata yang dicari dikirim ke layanan pencarian OpenStreetMap.</p>
    </div>
  );
}
