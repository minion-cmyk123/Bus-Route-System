import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  ShieldCheck,
  X,
  ArrowRight,
  MapPin,
  BusFront,
  Users,
  Bell,
} from 'lucide-react';
import type { Network, Route, User } from '../../shared/types';
import { clock, contrastText } from '../../shared/types';
import { api } from './api';
import { Empty, ErrorMessage, Loading, Modal, Status } from './components/UI';
type Overview = {
  counts: { users: number; routes: number; stops: number };
  auditLogs: {
    id: string;
    action: string;
    entityId: string;
    createdAt: string;
    actor: string | null;
  }[];
};
export function Admin({
  network,
  user,
  onAuth,
}: {
  network: Network;
  user: User | null;
  onAuth: () => void;
}) {
  const [tab, setTab] = useState('routes');
  const [route, setRoute] = useState<Route | 'new' | null>(null);
  const [stopOpen, setStopOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const qc = useQueryClient();
  const overview = useQuery({
    queryKey: ['admin'],
    queryFn: () => api<Overview>('/admin/overview'),
    enabled: user?.role === 'admin',
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['network'] });
    qc.invalidateQueries({ queryKey: ['admin'] });
    qc.invalidateQueries({ queryKey: ['journeys'] });
  };
  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/alerts/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
  if (user?.role !== 'admin')
    return (
      <div className="page">
        <div className="page-heading">
          <p className="eyebrow">BEHIND A BETTER JOURNEY</p>
          <h1>Network operations.</h1>
          <p>A considered workspace for the people keeping the city connected.</p>
        </div>
        <Empty
          icon={<ShieldCheck />}
          heading={user ? 'Administrator access required.' : 'The control room starts here.'}
        >
          <p>
            {user
              ? 'Your passenger account can plan trips and save journeys. Network changes require an administrator.'
              : 'Sign in with your administrator account to manage routes, stops and service notices.'}
          </p>
          {!user && (
            <button className="button primary" onClick={onAuth}>
              Sign in
              <ArrowRight size={17} />
            </button>
          )}
        </Empty>
      </div>
    );
  return (
    <div className="page">
      <div className="page-heading">
        <p className="eyebrow">THE NETWORK, IN YOUR HANDS</p>
        <h1>Network operations.</h1>
        <p>Manage schedules, keep passengers informed, and track every change.</p>
      </div>
      {overview.isPending ? (
        <Loading />
      ) : overview.isError ? (
        <ErrorMessage error={overview.error} />
      ) : (
        <div className="admin-stats">
          {[
            [BusFront, overview.data.counts.routes, 'Directional routes'],
            [MapPin, overview.data.counts.stops, 'Network stops'],
            [Users, overview.data.counts.users, 'Registered users'],
          ].map(([Icon, count, label]) => {
            const Component = Icon as typeof BusFront;
            return (
              <div key={String(label)}>
                <Component size={21} />
                <strong>{String(count)}</strong>
                <span>{String(label)}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="admin-tabs" role="tablist" aria-label="Operations sections">
        {['routes', 'stops', 'alerts', 'activity'].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'selected' : ''}
            onClick={() => setTab(t)}
          >
            {t === 'activity' ? 'Activity log' : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="admin-panel" role="tabpanel" aria-label={tab}>
        {tab === 'routes' && (
          <>
            <div className="panel-heading">
              <h2>Route management</h2>
              <button className="button primary compact" onClick={() => setRoute('new')}>
                <Plus size={16} />
                Add route
              </button>
            </div>
            <p className="muted small-text">
              Each record is one direction. Suspend a route to remove it from journey results.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Route</th>
                    <th>Service</th>
                    <th>Fare</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {network.routes.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span
                          className="route-code small"
                          style={{ background: r.color, color: contrastText(r.color) }}
                        >
                          {r.code}
                        </span>
                      </td>
                      <td>
                        <strong>{r.name}</strong>
                        <small>
                          {r.stops.length} stops · Version {r.version}
                        </small>
                      </td>
                      <td>
                        {clock(r.startMinute)}–{clock(r.endMinute)}
                        <small>Every {r.frequency} min</small>
                      </td>
                      <td>Rs {r.fare}</td>
                      <td>
                        <Status status={r.status} />
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Edit ${r.code}`}
                          onClick={() => setRoute(r)}
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {tab === 'stops' && (
          <>
            <div className="panel-heading">
              <h2>Connected stops</h2>
              <button className="button primary compact" onClick={() => setStopOpen(true)}>
                <Plus size={16} />
                Add stop
              </button>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Stop</th>
                    <th>Area</th>
                    <th>Coordinates</th>
                    <th>Access</th>
                  </tr>
                </thead>
                <tbody>
                  {network.stops.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name}</strong>
                      </td>
                      <td>{s.area}</td>
                      <td>
                        {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                      </td>
                      <td>{s.accessible ? 'Step-free' : 'Steps'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {tab === 'alerts' && (
          <>
            <div className="panel-heading">
              <h2>Passenger notices</h2>
              <button className="button primary compact" onClick={() => setAlertOpen(true)}>
                <Plus size={16} />
                Publish notice
              </button>
            </div>
            <ErrorMessage error={remove.error} />
            {network.alerts.map((a) => (
              <div className="admin-alert" key={a.id}>
                <Bell size={19} />
                <div>
                  <strong>{a.title}</strong>
                  <p>{a.message}</p>
                </div>
                <button
                  className="text-button danger-text"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(a.id)}
                >
                  Remove
                </button>
              </div>
            ))}
            {!network.alerts.length && <p className="muted">No active notices.</p>}
          </>
        )}
        {tab === 'activity' && (
          <>
            <div className="panel-heading">
              <h2>Recent changes</h2>
              <span className="muted small-text">Latest 30 events</span>
            </div>
            {overview.data?.auditLogs.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Administrator</th>
                      <th>Time (PKT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.data.auditLogs.map((a) => (
                      <tr key={a.id}>
                        <td>
                          {a.action}
                          <small>{a.entityId}</small>
                        </td>
                        <td>{a.actor ?? 'Former administrator'}</td>
                        <td>
                          {new Intl.DateTimeFormat('en-GB', {
                            timeZone: 'Asia/Karachi',
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(a.createdAt))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">Changes to routes, stops and notices will appear here.</p>
            )}
          </>
        )}
      </div>
      {route && (
        <RouteEditor
          route={route === 'new' ? null : route}
          network={network}
          onClose={() => setRoute(null)}
          onSaved={() => {
            invalidate();
            setRoute(null);
          }}
        />
      )}
      {stopOpen && (
        <StopEditor
          onClose={() => setStopOpen(false)}
          onSaved={() => {
            invalidate();
            setStopOpen(false);
          }}
        />
      )}
      {alertOpen && (
        <AlertEditor
          network={network}
          onClose={() => setAlertOpen(false)}
          onSaved={() => {
            invalidate();
            setAlertOpen(false);
          }}
        />
      )}
    </div>
  );
}
function RouteEditor({
  route,
  network,
  onClose,
  onSaved,
}: {
  route: Route | null;
  network: Network;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [stops, setStops] = useState(
    route?.stops.map((s) => ({ id: s.id, offset: s.offset })) ?? [
      { id: '', offset: 0 },
      { id: '', offset: 10 },
    ],
  );
  const [days, setDays] = useState(route?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const save = useMutation({
    mutationFn: (body: unknown) =>
      api(route ? `/admin/routes/${route.id}` : '/admin/routes', {
        method: route ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: onSaved,
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const minute = (key: string) => {
      const [h, m] = String(f.get(key)).split(':').map(Number);
      return h * 60 + m;
    };
    save.mutate({
      code: f.get('code'),
      name: f.get('name'),
      color: f.get('color'),
      fare: Number(f.get('fare')),
      status: f.get('status'),
      frequency: Number(f.get('frequency')),
      startMinute: minute('start'),
      endMinute: minute('end'),
      accessible: f.get('accessible') === 'on',
      days,
      stops,
      ...(route ? { version: route.version } : {}),
    });
  }
  return (
    <Modal wide title={route ? `Edit ${route.code}` : 'Create a route'} onClose={onClose}>
      <p className="muted">
        One direction per route. Stop offsets are minutes from the first stop; the first offset must
        be zero.
      </p>
      <form className="form-stack" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Route code
            <input
              name="code"
              defaultValue={route?.code}
              pattern="[A-Z0-9-]{1,10}"
              maxLength={10}
              placeholder="e.g. C5"
              required
            />
          </label>
          <label>
            Route name
            <input name="name" defaultValue={route?.name} maxLength={100} required />
          </label>
          <label>
            Line colour
            <input type="color" name="color" defaultValue={route?.color ?? '#38866b'} />
          </label>
          <label>
            Fare (PKR)
            <input
              type="number"
              name="fare"
              defaultValue={route?.fare ?? 50}
              min={0}
              max={10000}
              required
            />
          </label>
          <label>
            First departure
            <input
              type="time"
              name="start"
              defaultValue={clock(route?.startMinute ?? 360)}
              required
            />
          </label>
          <label>
            Last departure
            <input type="time" name="end" defaultValue={clock(route?.endMinute ?? 1200)} required />
          </label>
          <label>
            Frequency (minutes)
            <input
              type="number"
              name="frequency"
              min={1}
              max={180}
              defaultValue={route?.frequency ?? 15}
              required
            />
          </label>
          <label>
            Status
            <select name="status" defaultValue={route?.status ?? 'active'}>
              <option value="active">On schedule</option>
              <option value="delayed">Delayed</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
        </div>
        <fieldset className="days-field">
          <legend>Service days</legend>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
            <label key={day}>
              <input
                type="checkbox"
                checked={days.includes(i)}
                onChange={() =>
                  setDays(days.includes(i) ? days.filter((d) => d !== i) : [...days, i])
                }
              />
              {day}
            </label>
          ))}
        </fieldset>
        <label className="checkbox">
          <input type="checkbox" name="accessible" defaultChecked={route?.accessible ?? true} />
          Accessible buses on this route
        </label>
        <div className="panel-heading">
          <h3>Stop sequence</h3>
          <button
            type="button"
            className="text-button"
            disabled={stops.length >= 50}
            onClick={() => setStops([...stops, { id: '', offset: stops.at(-1)!.offset + 10 }])}
          >
            <Plus size={16} />
            Add stop
          </button>
        </div>
        <div className="editor-stops">
          {stops.map((s, i) => (
            <div key={i}>
              <span>{i + 1}</span>
              <select
                aria-label={`Stop ${i + 1}`}
                value={s.id}
                required
                onChange={(e) =>
                  setStops(stops.map((v, k) => (k === i ? { ...v, id: e.target.value } : v)))
                }
              >
                <option value="">Choose stop</option>
                {network.stops
                  .filter((v) => v.id === s.id || !stops.some((x) => x.id === v.id))
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
              </select>
              <label>
                <span className="sr-only">Offset for stop {i + 1}</span>
                <input
                  type="number"
                  aria-label={`Offset for stop ${i + 1}`}
                  min={0}
                  max={1439}
                  value={s.offset}
                  required
                  onChange={(e) =>
                    setStops(
                      stops.map((v, k) => (k === i ? { ...v, offset: Number(e.target.value) } : v)),
                    )
                  }
                />
              </label>
              <span>min</span>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove stop ${i + 1}`}
                disabled={stops.length <= 2}
                onClick={() => setStops(stops.filter((_, k) => k !== i))}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <ErrorMessage error={save.error} />
        <button className="button primary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save route'}
          <ArrowRight size={16} />
        </button>
      </form>
    </Modal>
  );
}
function StopEditor({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const save = useMutation({
    mutationFn: (body: unknown) =>
      api('/admin/stops', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: onSaved,
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({
      name: f.get('name'),
      area: f.get('area'),
      lat: Number(f.get('lat')),
      lng: Number(f.get('lng')),
      accessible: f.get('accessible') === 'on',
    });
  }
  return (
    <Modal title="Add a network stop" onClose={onClose}>
      <form onSubmit={submit} className="form-stack">
        <label>
          Stop name
          <input name="name" maxLength={100} required />
        </label>
        <label>
          Area
          <input name="area" maxLength={80} required />
        </label>
        <div className="form-grid">
          <label>
            Latitude
            <input type="number" name="lat" step="any" min={-90} max={90} required />
          </label>
          <label>
            Longitude
            <input type="number" name="lng" step="any" min={-180} max={180} required />
          </label>
        </div>
        <label className="checkbox">
          <input type="checkbox" name="accessible" defaultChecked />
          Step-free access
        </label>
        <p className="muted small-text">
          New stops are available in route editors and journey searches. The illustrative city map
          shows the original demo stops only.
        </p>
        <ErrorMessage error={save.error} />
        <button className="button primary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Add stop'}
        </button>
      </form>
    </Modal>
  );
}
function AlertEditor({
  network,
  onClose,
  onSaved,
}: {
  network: Network;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useMutation({
    mutationFn: (body: unknown) =>
      api('/admin/alerts', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: onSaved,
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({
      title: f.get('title'),
      message: f.get('message'),
      severity: f.get('severity'),
      routeId: f.get('routeId') || null,
      expiresAt: new Date(`${f.get('expiresAt')}:00+05:00`).toISOString(),
    });
  }
  return (
    <Modal title="Publish a service notice" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label>
          Title
          <input name="title" maxLength={120} required />
        </label>
        <label>
          Message
          <textarea name="message" maxLength={1000} rows={4} required />
        </label>
        <div className="form-grid">
          <label>
            Severity
            <select name="severity">
              <option value="info">Information</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label>
            Affected route
            <select name="routeId">
              <option value="">All routes</option>
              {network.routes.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.code} · {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Expires at (Pakistan time)
          <input type="datetime-local" name="expiresAt" required />
        </label>
        <ErrorMessage error={save.error} />
        <button className="button primary" disabled={save.isPending}>
          {save.isPending ? 'Publishing…' : 'Publish notice'}
        </button>
      </form>
    </Modal>
  );
}
