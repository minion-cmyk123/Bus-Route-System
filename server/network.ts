import type { Network, Route, RouteStop, Stop, Alert } from '../shared/types.js';
import type { Queryable } from './db/database.js';
export async function getNetwork(db: Queryable): Promise<Network> {
  const stops = (
    await db.query<Stop>('SELECT id,name,area,lat,lng,accessible FROM stops ORDER BY name')
  ).rows;
  const routes = (
    await db.query<Omit<Route, 'stops'>>(
      `SELECT id,code,name,color,fare,status,frequency,start_minute AS "startMinute",end_minute AS "endMinute",days,accessible,version FROM routes ORDER BY code`,
    )
  ).rows;
  const routeStops = (
    await db.query<RouteStop & { routeId: string }>(
      `SELECT s.*, rs.route_id AS "routeId",rs.sequence,rs.offset_minutes AS offset FROM route_stops rs JOIN stops s ON s.id=rs.stop_id ORDER BY rs.sequence`,
    )
  ).rows;
  const alerts = (
    await db.query<Alert>(
      `SELECT id,title,message,severity,route_id AS "routeId",created_at AS "createdAt",expires_at AS "expiresAt" FROM alerts WHERE expires_at > now() ORDER BY created_at DESC`,
    )
  ).rows;
  const demo =
    (await db.query<{ value: string }>("SELECT value FROM settings WHERE key='demo'")).rows[0]
      ?.value === 'true';
  return {
    stops,
    routes: routes.map((r) => ({ ...r, stops: routeStops.filter((s) => s.routeId === r.id) })),
    alerts,
    timezone: 'Asia/Karachi',
    demo,
  };
}
