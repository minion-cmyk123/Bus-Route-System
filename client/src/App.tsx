import { useState, useEffect, type FormEvent } from 'react';
import {
  NavLink,
  Routes,
  Route as RouterRoute,
  useNavigate,
  useSearchParams,
  useLocation,
} from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownUp,
  Route as RouteIcon,
  LayoutGrid,
  Bookmark,
  Bell,
  Settings2,
  BusFront,
  MapPin,
  Circle,
  Clock3,
  Leaf,
  Search,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Accessibility,
  Check,
  ShieldCheck,
  Navigation,
  CalendarDays,
  ExternalLink,
} from 'lucide-react';
import type { Network, Route, User, Journey, SavedJourney } from '../../shared/types';
import { clock, contrastText } from '../../shared/types';
import { api, localServiceDate, localServiceTime } from './api';
import { NetworkMap } from './components/NetworkMap';
import { AuthModal } from './components/AuthModal';
import { RouteDetail } from './components/RouteDetail';
import { ErrorMessage, Loading, Empty, SectionTitle, Status } from './components/UI';
import { Admin } from './admin';
export function App() {
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [detail, setDetail] = useState<Route | null>(null);
  const [toast, setToast] = useState('');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const network = useQuery({
    queryKey: ['network'],
    queryFn: ({ signal }) => api<Network>('/network', { signal }),
    refetchInterval: 60000,
  });
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<{ user: User | null }>('/auth/me') });
  const user = me.data?.user ?? null;
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const logout = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.setQueryData(['me'], { user: null });
      qc.removeQueries({ queryKey: ['saved'] });
      qc.removeQueries({ queryKey: ['admin'] });
      navigate('/');
      setToast('You have signed out.');
    },
  });
  function plan(from: string, to: string) {
    navigate(`/?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  }
  const title =
    location.pathname === '/routes'
      ? 'Explore routes'
      : location.pathname === '/saved'
        ? 'Saved journeys'
        : location.pathname === '/updates'
          ? 'Service updates'
          : location.pathname === '/operations'
            ? 'Operations'
            : 'Journey planner';
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {menuOpen && (
        <button
          className="nav-overlay"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <NavLink to="/" className="brand" aria-label="Routewise home">
          <span className="brand-mark">
            <RouteIcon size={23} />
          </span>
          routewise<span className="brand-period">.</span>
        </NavLink>
        <button
          className="mobile-close icon-button"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        >
          <X />
        </button>
        <div className="workspace-label">
          <span className="city-dot" /> Twin cities network
          <ChevronRight size={14} />
        </div>
        <p className="nav-label">YOUR EVERYDAY, SIMPLIFIED</p>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>
            <Navigation size={19} />
            Journey planner
          </NavLink>
          <NavLink to="/routes">
            <LayoutGrid size={19} />
            Explore routes
          </NavLink>
          <NavLink to="/saved">
            <Bookmark size={19} />
            Saved journeys
          </NavLink>
          <NavLink to="/updates">
            <Bell size={19} />
            Service updates
            {Boolean(network.data?.alerts.length) && (
              <span className="nav-count">{network.data!.alerts.length}</span>
            )}
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="commute-note">
            <div className="leaf-badge">
              <Leaf size={21} />
            </div>
            <h3>
              Small trips.
              <br />
              Better cities.
            </h3>
            <p>One shared ride is a good place to start.</p>
            <span>
              Move together <ArrowUpRight size={14} />
            </span>
          </div>
          <NavLink to="/operations" className="operations-link">
            <Settings2 size={18} /> Operations
            <ArrowUpRight size={14} />
          </NavLink>
          <div className="sidebar-footer">
            <span className="green-dot" />
            Designed for the everyday
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </button>
            <span className="desktop-label">Workspace</span>
            <ChevronRight size={13} className="desktop-label" />
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="city-label">
              <MapPin size={14} />
              Islamabad · Rawalpindi
            </span>
            <button
              className="notification-button icon-button"
              aria-label="View service updates"
              onClick={() => navigate('/updates')}
            >
              <Bell size={19} />
              {Boolean(network.data?.alerts.length) && <i />}
            </button>
            <div className="topbar-divider" />
            {user ? (
              <>
                <span className="avatar" title={user.name}>
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="user-name">{user.name.split(' ')[0]}</span>
                <button
                  className="icon-button"
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                  aria-label="Sign out"
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <button className="sign-in" onClick={() => setAuthOpen(true)}>
                Sign in <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </header>
        <main id="main">
          <ErrorMessage error={logout.error} />
          {network.isPending ? (
            <Loading />
          ) : network.isError ? (
            <div className="page">
              <ErrorMessage error={network.error} />
              <button className="button secondary" onClick={() => network.refetch()}>
                Try again
              </button>
            </div>
          ) : (
            <Routes>
              <RouterRoute
                path="/"
                element={
                  <Planner
                    network={network.data}
                    user={user}
                    onAuth={() => setAuthOpen(true)}
                    onToast={setToast}
                    onDetail={setDetail}
                  />
                }
              />
              <RouterRoute
                path="/routes"
                element={<Explore network={network.data} onDetail={setDetail} />}
              />
              <RouterRoute
                path="/saved"
                element={
                  <Saved
                    network={network.data}
                    user={user}
                    onAuth={() => setAuthOpen(true)}
                    onPlan={plan}
                  />
                }
              />
              <RouterRoute path="/updates" element={<Updates network={network.data} />} />
              <RouterRoute
                path="/operations"
                element={
                  <Admin network={network.data} user={user} onAuth={() => setAuthOpen(true)} />
                }
              />
              <RouterRoute
                path="*"
                element={
                  <Empty icon={<RouteIcon />} heading="This route doesn’t exist.">
                    <p>Let’s find a better way.</p>
                    <button className="button primary" onClick={() => navigate('/')}>
                      Back to planner
                    </button>
                  </Empty>
                }
              />
            </Routes>
          )}
        </main>
        <footer className="page-footer">
          <span>© {new Date().getFullYear()} Routewise</span>
          <span>
            {network.data?.demo
              ? 'Demonstration network · Not a travel information service'
              : 'Scheduled departures · Times in PKT'}
          </span>
          <a
            href="https://github.com/minion-cmyk123/Bus-Route-System"
            target="_blank"
            rel="noreferrer"
          >
            Built in the open <ExternalLink size={12} />
          </a>
        </footer>
      </div>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      {detail && <RouteDetail route={detail} onClose={() => setDetail(null)} onPlan={plan} />}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
function Planner({
  network,
  user,
  onAuth,
  onToast,
  onDetail,
}: {
  network: Network;
  user: User | null;
  onAuth: () => void;
  onToast: (s: string) => void;
  onDetail: (r: Route) => void;
}) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [from, setFrom] = useState(params.get('from') ?? '');
  const [to, setTo] = useState(params.get('to') ?? '');
  const [date, setDate] = useState(localServiceDate);
  const [time, setTime] = useState(localServiceTime);
  const [accessible, setAccessible] = useState(false);
  const [search, setSearch] = useState<{
    from: string;
    to: string;
    date: string;
    time: string;
    accessible: string;
  } | null>(null);
  useEffect(() => {
    setFrom(params.get('from') ?? '');
    setTo(params.get('to') ?? '');
    setSearch(null);
  }, [params]);
  const results = useQuery({
    queryKey: ['journeys', search],
    queryFn: ({ signal }) =>
      api<{ journeys: Journey[] }>(`/journeys?${new URLSearchParams(search!)}`, { signal }),
    enabled: !!search,
  });
  const saved = useMutation({
    mutationFn: () =>
      api('/saved', {
        method: 'POST',
        body: JSON.stringify({
          fromId: search!.from,
          toId: search!.to,
          label: `${name(search!.from)} → ${name(search!.to)}`.slice(0, 80),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved'] });
      onToast('Journey saved. One less thing to plan.');
    },
  });
  function name(id: string) {
    return network.stops.find((s) => s.id === id)?.name ?? id;
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    saved.reset();
    setSearch({ from, to, date, time, accessible: String(accessible) });
  }
  const featured = network.routes.filter((r) => !r.id.endsWith('-return')).slice(0, 3);
  const active = network.routes.filter((r) => r.status === 'active').length;
  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="eyebrow">
            <span className="tiny-line" /> LESS GUESSWORK. MORE GOING.
          </div>
          <h1>
            A better way to <em>get there.</em>
          </h1>
          <p>Your city is full of possibilities. Let’s find your route.</p>
        </div>
        <div className="hero-date">
          <CalendarDays size={17} />
          <div>
            <strong>
              {new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Karachi',
                weekday: 'long',
                day: 'numeric',
                month: 'short',
              }).format(new Date())}
            </strong>
            <span>A good day to take the bus.</span>
          </div>
        </div>
      </section>
      <div className="overview-strip">
        <div>
          <span className="stat-icon">
            <BusFront size={18} />
          </span>
          <strong>{network.routes.length}</strong>
          <span>Directional routes</span>
        </div>
        <div>
          <span className="stat-icon">
            <MapPin size={18} />
          </span>
          <strong>{network.stops.length}</strong>
          <span>Connected stops</span>
        </div>
        <div>
          <span className="stat-icon">
            <Clock3 size={18} />
          </span>
          <strong>
            {active}/{network.routes.length}
          </strong>
          <span>On schedule</span>
        </div>
        <div className="network-health">
          <span className="green-dot" />
          {network.demo ? 'Demo network' : 'Scheduled services'}
          <span className="pill">PKT</span>
        </div>
      </div>
      <div className="planner-layout">
        <section className="planner-card">
          <div className="card-kicker">
            <span className="square-icon">
              <Navigation size={17} />
            </span>
            <span>LET’S GET YOU MOVING</span>
          </div>
          <h2>Where are we headed?</h2>
          <form onSubmit={submit}>
            <div className="stop-fields">
              <label className="stop-field">
                <Circle size={15} />
                <span>
                  <span className="field-label">FROM</span>
                  <select
                    aria-label="Starting stop"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    required
                  >
                    <option value="">Choose your starting stop</option>
                    {network.stops.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <button
                type="button"
                className="swap-button"
                aria-label="Swap starting stop and destination"
                onClick={() => {
                  setFrom(to);
                  setTo(from);
                }}
              >
                <ArrowDownUp size={17} />
              </button>
              <label className="stop-field">
                <MapPin size={17} />
                <span>
                  <span className="field-label">TO</span>
                  <select
                    aria-label="Destination stop"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    required
                  >
                    <option value="">Choose your destination</option>
                    {network.stops
                      .filter((s) => s.id !== from)
                      .map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </span>
              </label>
            </div>
            <div className="time-fields">
              <label>
                Travel date
                <input
                  aria-label="Travel date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </label>
              <label>
                Leave after (PKT)
                <input
                  aria-label="Departure time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </label>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={accessible}
                onChange={(e) => setAccessible(e.target.checked)}
              />
              <Accessibility size={15} />
              Step-free stops & accessible buses
            </label>
            <button className="button primary full" disabled={results.isFetching || from === to}>
              {results.isFetching ? 'Finding your way…' : 'Find my route'}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="planner-note">
            <ShieldCheck size={15} />
            <span>Clear fares. Simple transfers. A little less stress.</span>
          </div>
        </section>
        <NetworkMap
          network={network}
          onStop={(id) => {
            setFrom(id);
            onToast(`${name(id)} selected as your starting stop.`);
          }}
        />
      </div>
      <div className="popular">
        <span>POPULAR JOURNEYS</span>
        {[
          ['saddar', 'secretariat'],
          ['faizabad', 'f6'],
          ['nust', 'centaurus'],
        ]
          .filter(
            ([a, b]) =>
              network.stops.some((s) => s.id === a) && network.stops.some((s) => s.id === b),
          )
          .map(([a, b]) => (
            <button
              key={a}
              onClick={() => {
                setParams({ from: a, to: b });
              }}
            >
              {name(a)} <ArrowRight size={12} /> {name(b)}
              <ArrowUpRight size={12} />
            </button>
          ))}
      </div>
      {search && (
        <section className="results-section" aria-live="polite">
          <SectionTitle
            eyebrow={`${search.date} · AFTER ${search.time} PKT`}
            title={`${name(search.from)} to ${name(search.to)}`}
          />
          {results.isFetching ? (
            <Loading label="Finding available departures…" />
          ) : results.isError ? (
            <ErrorMessage error={results.error} />
          ) : results.data?.journeys.length ? (
            <>
              <div className="results-toolbar">
                <span>{results.data.journeys.length} options · Earliest arrival first</span>
                <button
                  className="text-button"
                  disabled={saved.isPending || saved.isSuccess}
                  onClick={() => (user ? saved.mutate() : onAuth())}
                >
                  <Bookmark size={16} />
                  {saved.isSuccess ? 'Saved' : 'Save journey'}
                </button>
              </div>
              <ErrorMessage error={saved.error} />
              <div className="journey-results">
                {results.data.journeys.map((j, i) => (
                  <article className="journey-result" key={j.id}>
                    <div className="journey-result-top">
                      <span className={i === 0 ? 'best-option' : 'subtle-label'}>
                        {i === 0
                          ? 'EARLIEST ARRIVAL'
                          : j.transfers
                            ? 'ONE TRANSFER'
                            : 'DIRECT SERVICE'}
                      </span>
                      <strong>Rs {j.fare}</strong>
                    </div>
                    <div className="journey-times">
                      <strong>{clock(j.departure)}</strong>
                      <div>
                        <span>
                          {j.duration} min · {j.transfers ? '1 transfer' : 'Direct'}
                        </span>
                        <div className="journey-line" />
                      </div>
                      <strong>{clock(j.arrival)}</strong>
                    </div>
                    {j.legs.map((l, k) => (
                      <div className="journey-leg" key={l.routeId}>
                        <span
                          className="route-code small"
                          style={{ background: l.color, color: contrastText(l.color) }}
                        >
                          {l.code}
                        </span>
                        <div>
                          <strong>
                            {name(l.from)} <ArrowRight size={12} /> {name(l.to)}
                          </strong>
                          <small>
                            {clock(l.departure)}–{clock(l.arrival)}
                            {k > 0 ? ` · ${l.departure - j.legs[k - 1].arrival} min transfer` : ''}
                            {network.routes.find((r) => r.id === l.routeId)?.status === 'delayed'
                              ? ' · Delays reported; times may vary'
                              : ''}
                          </small>
                        </div>
                      </div>
                    ))}
                  </article>
                ))}
              </div>
              <p className="muted small-text">
                Scheduled times, not live arrivals. Transfers include at least 5 minutes between
                services.
              </p>
            </>
          ) : (
            <Empty icon={<BusFront size={26} />} heading="No journeys at this time.">
              <p>
                Try an earlier departure, another day, or different stops. The planner supports
                direct trips and one transfer.
              </p>
            </Empty>
          )}
        </section>
      )}
      <section className="featured-section">
        <SectionTitle
          eyebrow="GET TO KNOW YOUR NETWORK"
          title="Good routes. Great possibilities."
          action="Explore all routes"
          onAction={() => navigate('/routes')}
        />
        <div className="route-grid">
          {featured.map((r) => (
            <RouteCard key={r.id} route={r} onClick={() => onDetail(r)} />
          ))}
        </div>
      </section>
      <section className="bottom-banner">
        <div className="banner-art">
          <Leaf size={36} />
          <span />
          <i />
        </div>
        <div>
          <span className="eyebrow">THE JOURNEY IS BETTER TOGETHER</span>
          <h3>A little more shared. A little less traffic.</h3>
          <p>Your everyday commute can be part of a better-connected city.</p>
        </div>
        <button className="button light" onClick={() => navigate('/saved')}>
          Make it a routine
          <ArrowUpRight size={16} />
        </button>
      </section>
    </div>
  );
}
function RouteCard({ route: r, onClick }: { route: Route; onClick: () => void }) {
  return (
    <button className="route-card" onClick={onClick}>
      <div className="route-card-top">
        <span className="route-code" style={{ background: r.color, color: contrastText(r.color) }}>
          {r.code}
        </span>
        <Status status={r.status} />
        <ArrowUpRight size={18} className="route-arrow" />
      </div>
      <h3>{r.name}</h3>
      <p>
        {r.stops[0]?.name}
        <ArrowRight size={13} />
        {r.stops.at(-1)?.name}
      </p>
      <div className="route-card-bottom">
        <span>
          <Clock3 size={14} />
          Every {r.frequency} min
        </span>
        <span>{r.stops.length} stops</span>
        <strong>Rs {r.fare}</strong>
      </div>
    </button>
  );
}
function Explore({ network, onDetail }: { network: Network; onDetail: (r: Route) => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const routes = network.routes.filter(
    (r) =>
      (filter === 'all' || r.status === filter) &&
      `${r.name} ${r.code} ${r.stops.map((s) => s.name).join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="page">
      <PageHeading
        eyebrow="A CITY OF CONNECTIONS"
        title="Find your favourite line."
        description="A closer look at the routes that bring the twin cities together."
      />
      <div className="filter-bar">
        <label className="search-field">
          <Search size={18} />
          <input
            placeholder="Search routes, stops or route codes"
            aria-label="Search routes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Route status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All services</option>
          <option value="active">On schedule</option>
          <option value="delayed">Delays reported</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      <p className="muted small-text">
        {routes.length} directional routes · Select a route for its full timetable.
      </p>
      {routes.length ? (
        <div className="route-grid">
          {routes.map((r) => (
            <RouteCard route={r} key={r.id} onClick={() => onDetail(r)} />
          ))}
        </div>
      ) : (
        <Empty icon={<Search />} heading="No matching routes.">
          <p>Try another stop name or clear your filters.</p>
          <button
            className="text-button"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
          >
            Clear filters
          </button>
        </Empty>
      )}
    </div>
  );
}
function Saved({
  network,
  user,
  onAuth,
  onPlan,
}: {
  network: Network;
  user: User | null;
  onAuth: () => void;
  onPlan: (a: string, b: string) => void;
}) {
  const qc = useQueryClient();
  const saved = useQuery({
    queryKey: ['saved', user?.id],
    queryFn: () => api<{ journeys: SavedJourney[] }>('/saved'),
    enabled: !!user,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/saved/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  });
  return (
    <div className="page">
      <PageHeading
        eyebrow="THE PLACES YOU GO"
        title="Your everyday, on repeat."
        description="Keep your regular journeys close. Fresh departures are one click away."
      />
      {!user ? (
        <Empty icon={<Bookmark />} heading="Your routes, ready when you are.">
          <p>Sign in to save journeys across your devices.</p>
          <button className="button primary" onClick={onAuth}>
            Sign in to get started
            <ArrowRight size={16} />
          </button>
        </Empty>
      ) : saved.isPending ? (
        <Loading />
      ) : saved.isError ? (
        <ErrorMessage error={saved.error} />
      ) : (
        <>
          <ErrorMessage error={remove.error} />
          {saved.data?.journeys.length ? (
            <div className="saved-grid">
              {saved.data.journeys.map((j) => (
                <article className="saved-card" key={j.id}>
                  <Bookmark size={20} />
                  <h3>{j.label}</h3>
                  <p>
                    {network.stops.find((s) => s.id === j.fromId)?.name} →{' '}
                    {network.stops.find((s) => s.id === j.toId)?.name}
                  </p>
                  <div>
                    <button className="button secondary" onClick={() => onPlan(j.fromId, j.toId)}>
                      Plan journey
                      <ArrowRight size={16} />
                    </button>
                    <button
                      className="text-button danger-text"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(j.id)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty icon={<Bookmark />} heading="A fresh start.">
              <p>Find a journey in the planner, then choose “Save journey”.</p>
              <NavLink className="button primary" to="/">
                Find a route
                <ArrowRight size={16} />
              </NavLink>
            </Empty>
          )}
        </>
      )}
    </div>
  );
}
function Updates({ network }: { network: Network }) {
  return (
    <div className="page">
      <PageHeading
        eyebrow="A HEADS-UP BEFORE YOU HEAD OUT"
        title="Stay one stop ahead."
        description="Service notices and important updates from your network."
      />
      {network.alerts.length ? (
        <div className="alerts-list">
          {network.alerts.map((a) => (
            <article key={a.id} className={`alert-card ${a.severity}`}>
              <span className="alert-icon">
                <Bell size={20} />
              </span>
              <div>
                <div className="alert-meta">
                  <span>{a.severity === 'info' ? 'NETWORK NOTICE' : a.severity.toUpperCase()}</span>
                  <span>
                    {a.routeId
                      ? network.routes.find((r) => r.id === a.routeId)?.code
                      : 'All routes'}
                  </span>
                </div>
                <h3>{a.title}</h3>
                <p>{a.message}</p>
                <small>
                  Published{' '}
                  {new Intl.DateTimeFormat('en-GB', {
                    timeZone: 'Asia/Karachi',
                    dateStyle: 'medium',
                  }).format(new Date(a.createdAt))}{' '}
                  · Times in PKT
                </small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty icon={<Check />} heading="You’re all caught up.">
          <p>No active service notices.</p>
        </Empty>
      )}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="page-heading">
      <p className="eyebrow">
        <span className="tiny-line" />
        {eyebrow}
      </p>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}
