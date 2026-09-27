export type User = { id: string; name: string; email: string; role: 'passenger' | 'admin' };
export type Stop = {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  accessible: boolean;
};
export type RouteStop = Stop & { sequence: number; offset: number };
export type Route = {
  id: string;
  code: string;
  name: string;
  color: string;
  fare: number;
  status: 'active' | 'delayed' | 'suspended';
  frequency: number;
  startMinute: number;
  endMinute: number;
  days: number[];
  accessible: boolean;
  version: number;
  stops: RouteStop[];
};
export type Alert = {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  routeId: string | null;
  createdAt: string;
  expiresAt: string;
};
export type Network = {
  stops: Stop[];
  routes: Route[];
  alerts: Alert[];
  timezone: string;
  demo: boolean;
};
export type Leg = {
  routeId: string;
  code: string;
  color: string;
  from: string;
  to: string;
  departure: number;
  arrival: number;
  fare: number;
};
export type Journey = {
  id: string;
  legs: Leg[];
  departure: number;
  arrival: number;
  duration: number;
  fare: number;
  transfers: number;
};
export type SavedJourney = {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  createdAt: string;
};
export function clock(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
/** Choose accessible text for arbitrary operator-selected route colours. */
export function contrastText(hex: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return luminance > 0.179 ? '#000000' : '#ffffff';
}
