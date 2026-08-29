import { useEffect, useMemo, useState } from "react";
import type { SalesByState } from "../../api/types";

// --- State-name matching -------------------------------------------------
// The sales CSV stores UPPERCASE names ("TAMIL NADU", "JAMMU & KASHMIR").
// The GeoJSON uses title-case modern names ("Tamil Nadu", "Jammu and Kashmir").
// Canonicalise both to A-Z only (& -> AND) and alias the tricky ones.
function canon(name: string): string {
  return (name || "").toUpperCase().replace(/&/g, "AND").replace(/[^A-Z]/g, "");
}
const ALIASES: Record<string, string> = {
  PONDICHERRY: "PUDUCHERRY",
  ANDAMANANDNICOBARIS: "ANDAMANANDNICOBARISLANDS",
  ANDAMANNICOBARIS: "ANDAMANANDNICOBARISLANDS",
  CHATTISGARH: "CHHATTISGARH",
  ORISSA: "ODISHA",
  UTTARANCHAL: "UTTARAKHAND",
  NCTOFDELHI: "DELHI",
  DADRAANDNAGARHAVELI: "DADRAANDNAGARHAVELIANDDAMANANDDIU",
  DAMANANDDIU: "DADRAANDNAGARHAVELIANDDAMANANDDIU",
};
const key = (name: string) => {
  const c = canon(name);
  return ALIASES[c] ?? c;
};

type Ring = [number, number][];
interface Feature {
  properties: { state: string };
  geometry: { type: string; coordinates: Ring[][] };
}

const W = 500;
const H = 560;
const PAD = 12;

export function IndiaMap({ data }: { data: SalesByState[] }) {
  const [features, setFeatures] = useState<Feature[] | null>(null);
  const [hover, setHover] = useState<{
    d: SalesByState;
    state: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/india_states.geojson")
      .then((r) => r.json())
      .then((g) => alive && setFeatures(g.features))
      .catch(() => alive && setFeatures([]));
    return () => {
      alive = false;
    };
  }, []);

  // Aggregated value lookup per canonical state key.
  const valueByKey = useMemo(() => {
    const m = new Map<string, SalesByState>();
    for (const d of data) m.set(key(d.state_name), d);
    return m;
  }, [data]);
  const maxUnits = Math.max(1, ...data.map((d) => d.units));

  // Fit an equirectangular projection (latitude-corrected) to the geometry bounds.
  const paths = useMemo(() => {
    if (!features || features.length === 0) return [] as { state: string; d: string }[];
    let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
    for (const f of features)
      for (const poly of f.geometry.coordinates)
        for (const ring of poly)
          for (const [lng, lat] of ring) {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }
    const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const kx = Math.cos(midLat); // longitude compression at mid-latitude
    const geoW = (maxLng - minLng) * kx;
    const geoH = maxLat - minLat;
    const scale = Math.min((W - 2 * PAD) / geoW, (H - 2 * PAD) / geoH);
    const offX = (W - geoW * scale) / 2;
    const offY = (H - geoH * scale) / 2;
    const proj = (lng: number, lat: number): [number, number] => [
      offX + (lng - minLng) * kx * scale,
      offY + (maxLat - lat) * scale,
    ];

    return features.map((f) => {
      let d = "";
      for (const poly of f.geometry.coordinates) {
        for (const ring of poly) {
          d += ring
            .map(([lng, lat], i) => {
              const [x, y] = proj(lng, lat);
              return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
          d += "Z";
        }
      }
      return { state: f.properties.state, d };
    });
  }, [features]);

  const fillFor = (units: number | undefined) => {
    if (!units) return "var(--panel-2)";
    // sqrt scale so smaller states stay visible; opacity 0.22 -> 0.95.
    const t = Math.sqrt(units) / Math.sqrt(maxUnits);
    return `rgba(109, 94, 252, ${(0.22 + t * 0.73).toFixed(3)})`;
  };

  if (!features) {
    return <div className="py-16 text-center text-sm text-[var(--muted)]">Loading map…</div>;
  }

  const unmatched = data.filter((d) => !paths.some((p) => key(p.state) === key(d.state_name)));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[500px]">
        {paths.map((p) => {
          const d = valueByKey.get(key(p.state));
          return (
            <path
              key={p.state}
              d={p.d}
              fill={fillFor(d?.units)}
              stroke="var(--border)"
              className="cursor-pointer transition-[fill] hover:stroke-[var(--accent)]"
              style={{ strokeWidth: hover?.state === p.state ? 1.6 : 0.6 }}
              onMouseMove={(e) => {
                const svg = e.currentTarget.ownerSVGElement!;
                const r = svg.getBoundingClientRect();
                setHover({
                  d: d ?? { state_name: p.state, units: 0, gross_sales: 0, orders: 0 },
                  state: p.state,
                  x: ((e.clientX - r.left) / r.width) * 100,
                  y: ((e.clientY - r.top) / r.height) * 100,
                });
              }}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-[var(--muted)]">
        <span>Low</span>
        <div
          className="h-2 w-40 rounded-full"
          style={{
            background: "linear-gradient(90deg, rgba(109,94,252,0.22), rgba(109,94,252,0.95))",
          }}
        />
        <span>High</span>
        <span className="ml-1">(units sold)</span>
      </div>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs shadow-lg"
          style={{ left: `${hover.x}%`, top: `${hover.y}%`, transform: "translate(-50%, -120%)" }}
        >
          <div className="font-semibold text-[var(--text)]">{hover.d.state_name}</div>
          <div className="text-[var(--muted)]">
            {hover.d.units.toLocaleString()} units · ₹{hover.d.gross_sales.toLocaleString()}
          </div>
          <div className="text-[var(--muted)]">{hover.d.orders.toLocaleString()} orders</div>
        </div>
      )}

      {unmatched.length > 0 && (
        <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
          Unmatched region{unmatched.length > 1 ? "s" : ""}:{" "}
          {unmatched.map((u) => u.state_name).join(", ")}
        </p>
      )}
    </div>
  );
}
