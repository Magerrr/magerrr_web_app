// Lokasi tempat sesi (MAGERRR-18): tautan peta yang ditempel, atau titik yang dipilih di peta. Murni (tanpa IO).

export interface VenueLocation {
  /** tautan peta yang ditempel (mis. Google Maps); http/https */
  url: string | null;
  lat: number | null;
  lng: number | null;
}

/** Koordinat dibulatkan 6 desimal (±0,1 m) agar rapi disimpan & dibandingkan. */
export const roundCoord = (value: number) => Math.round(value * 1e6) / 1e6;

/** Tautan untuk membuka lokasi: tautan yang ditempel, kalau tidak ada titik → Google Maps; tanpa lokasi → null. */
export function mapsUrl(location: VenueLocation): string | null {
  if (location.url) return location.url;
  if (location.lat === null || location.lng === null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${roundCoord(location.lat)},${roundCoord(location.lng)}`;
}

/** Hanya tautan http/https yang diterima (bukan `javascript:` dsb.). */
export function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
