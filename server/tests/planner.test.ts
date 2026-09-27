import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planJourneys } from '../planner.js';
import { routeSchema } from '../validation.js';
import type { Route } from '../../shared/types.js';
function route(id: string, ids: string[], offsets: number[], extra: Partial<Route> = {}): Route {
  return {
    id,
    code: id,
    name: id,
    color: '#336633',
    fare: 50,
    status: 'active',
    frequency: 10,
    startMinute: 360,
    endMinute: 1200,
    days: [0, 1, 2, 3, 4, 5, 6],
    accessible: true,
    version: 1,
    stops: ids.map((id, i) => ({
      id,
      name: id,
      area: 'City',
      lat: 33,
      lng: 73,
      accessible: true,
      sequence: i,
      offset: offsets[i],
    })),
    ...extra,
  };
}
test('direct journey rounds to departure at the boarding stop, not the origin', () => {
  const result = planJourneys([route('A', ['a', 'b', 'c'], [0, 7, 19])], 'b', 'c', 370, 1);
  assert.equal(result[0].departure, 377);
  assert.equal(result[0].arrival, 389);
  assert.equal(result[0].fare, 50);
});
test('transfer includes at least five minutes and adds both fares', () => {
  const result = planJourneys(
    [route('A', ['a', 'b'], [0, 12]), route('B', ['b', 'c'], [0, 18])],
    'a',
    'c',
    360,
    1,
  );
  assert.equal(result[0].legs[1].departure, 380);
  assert.equal(result[0].arrival, 398);
  assert.equal(result[0].fare, 100);
  assert.equal(result[0].transfers, 1);
});
test('directional route cannot be travelled backwards', () =>
  assert.deepEqual(planJourneys([route('A', ['a', 'b'], [0, 12])], 'b', 'a', 360, 1), []));
test('closed service, suspended routes and inactive weekdays are excluded', () => {
  for (const r of [
    route('A', ['a', 'b'], [0, 12], { endMinute: 360 }),
    route('A', ['a', 'b'], [0, 12], { status: 'suspended' }),
    route('A', ['a', 'b'], [0, 12], { days: [0] }),
  ])
    assert.deepEqual(planJourneys([r], 'a', 'b', 400, 1), []);
});
test('service end is based on first-stop departure so downstream boarding still works', () => {
  const result = planJourneys(
    [route('A', ['a', 'b', 'c'], [0, 20, 30], { endMinute: 360 })],
    'b',
    'c',
    380,
    1,
  );
  assert.equal(result[0].arrival, 390);
});
test('accessible filter excludes inaccessible buses and boarding stops', () => {
  assert.equal(
    planJourneys([route('A', ['a', 'b'], [0, 12], { accessible: false })], 'a', 'b', 360, 1, true)
      .length,
    0,
  );
  const r = route('A', ['a', 'b'], [0, 12]);
  r.stops[0].accessible = false;
  assert.equal(planJourneys([r], 'a', 'b', 360, 1, true).length, 0);
});
test('earliest arrival outranks earliest departure', () => {
  const result = planJourneys(
    [route('A', ['a', 'b'], [0, 50]), route('B', ['a', 'b'], [0, 20], { startMinute: 370 })],
    'a',
    'b',
    360,
    1,
  );
  assert.equal(result[0].legs[0].routeId, 'B');
});
test('route validation rejects non-monotonic stops and overnight service', () => {
  const r = route('A', ['a', 'b'], [0, 20]);
  const { id, version, ...raw } = r;
  const input = { ...raw, stops: r.stops.map((s) => ({ id: s.id, offset: s.offset })) };
  assert.equal(routeSchema.safeParse(input).success, true);
  assert.equal(
    routeSchema.safeParse({
      ...input,
      stops: [
        { id: 'a', offset: 0 },
        { id: 'b', offset: 0 },
      ],
    }).success,
    false,
  );
  assert.equal(routeSchema.safeParse({ ...input, endMinute: 1430 }).success, false);
});
