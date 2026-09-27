import { Accessibility, Clock3, Coins, ArrowRight } from 'lucide-react';
import type { Route } from '../../../shared/types';
import { clock, contrastText } from '../../../shared/types';
import { Modal, Status } from './UI';
export function RouteDetail({
  route,
  onClose,
  onPlan,
}: {
  route: Route;
  onClose: () => void;
  onPlan: (from: string, to: string) => void;
}) {
  return (
    <Modal title={route.name} onClose={onClose}>
      <div className="route-detail-head">
        <span
          className="route-code"
          style={{ background: route.color, color: contrastText(route.color) }}
        >
          {route.code}
        </span>
        <Status status={route.status} />
      </div>
      <div className="detail-stats">
        <span>
          <Clock3 size={16} />
          Every {route.frequency} min
        </span>
        <span>
          <Coins size={16} />
          Rs {route.fare}
        </span>
        <span>
          <Accessibility size={16} />
          {route.accessible ? 'Accessible bus' : 'Standard bus'}
        </span>
      </div>
      <p className="muted">
        Departures from the first stop: {clock(route.startMinute)}–{clock(route.endMinute)} (PKT).{' '}
        {route.days.length === 7
          ? 'Daily service.'
          : route.days.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') +
            '.'}{' '}
        Timings are scheduled, not live predictions.
      </p>
      <ol className="stop-timeline">
        {route.stops.map((s, i) => (
          <li key={s.id}>
            <span className="timeline-dot" style={{ borderColor: route.color }} />
            <div>
              <strong>{s.name}</strong>
              <small>
                {s.area}
                {!s.accessible ? ' · Step access' : ''}
              </small>
            </div>
            <span>{i === 0 ? 'Start' : `+${s.offset} min`}</span>
          </li>
        ))}
      </ol>
      <button
        className="button primary full"
        disabled={route.status === 'suspended'}
        onClick={() => {
          onPlan(route.stops[0].id, route.stops.at(-1)!.id);
          onClose();
        }}
      >
        Plan this journey
        <ArrowRight size={17} />
      </button>
    </Modal>
  );
}
