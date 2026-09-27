import type { Journey, Leg, Route } from '../shared/types.js';
/** Timetable routing for a single service date. Routes are directional. */
export function planJourneys(
  routes: Route[],
  from: string,
  to: string,
  earliest: number,
  weekday: number,
  accessible = false,
): Journey[] {
  const available = routes.filter(
    (r) => r.status !== 'suspended' && r.days.includes(weekday) && (!accessible || r.accessible),
  );
  function leg(r: Route, a: string, b: string, after: number): Leg | null {
    const i = r.stops.findIndex((s) => s.id === a);
    const j = r.stops.findIndex((s) => s.id === b);
    if (i < 0 || j <= i) return null;
    if (accessible && (!r.stops[i].accessible || !r.stops[j].accessible)) return null;
    const first = r.startMinute + r.stops[i].offset;
    const departure = first + Math.max(0, Math.ceil((after - first) / r.frequency)) * r.frequency;
    const originDeparture = departure - r.stops[i].offset;
    const arrival = departure + r.stops[j].offset - r.stops[i].offset;
    if (originDeparture > r.endMinute || arrival > 1439) return null;
    return {
      routeId: r.id,
      code: r.code,
      color: r.color,
      from: a,
      to: b,
      departure,
      arrival,
      fare: r.fare,
    };
  }
  const journeys: Journey[] = [];
  function add(legs: Leg[]) {
    const departure = legs[0].departure,
      arrival = legs.at(-1)!.arrival;
    journeys.push({
      id: legs.map((l) => `${l.routeId}:${l.from}:${l.to}:${l.departure}`).join('|'),
      legs,
      departure,
      arrival,
      duration: arrival - departure,
      fare: legs.reduce((s, l) => s + l.fare, 0),
      transfers: legs.length - 1,
    });
  }
  for (const r of available) {
    const direct = leg(r, from, to, earliest);
    if (direct) add([direct]);
    const fromIndex = r.stops.findIndex((s) => s.id === from);
    if (fromIndex < 0) continue;
    for (const interchange of r.stops.slice(fromIndex + 1)) {
      if (interchange.id === to) continue;
      const first = leg(r, from, interchange.id, earliest);
      if (!first) continue;
      for (const secondRoute of available) {
        if (secondRoute.id === r.id) continue;
        const second = leg(secondRoute, interchange.id, to, first.arrival + 5);
        if (second) add([first, second]);
      }
    }
  }
  // Keep earliest result per route combination; rank by arrival, transfers, fare.
  const unique = new Map<string, Journey>();
  for (const j of journeys.sort(
    (a, b) => a.arrival - b.arrival || a.transfers - b.transfers || a.fare - b.fare,
  )) {
    const key = j.legs.map((l) => l.routeId).join('|');
    if (!unique.has(key)) unique.set(key, j);
  }
  return [...unique.values()].slice(0, 8);
}
