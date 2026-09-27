import type { Database } from './database.js';
export async function seedDemo(db: Database) {
  await db.transaction(async (tx) => {
    await tx.query('LOCK TABLE settings IN EXCLUSIVE MODE');
    if ((await tx.query("SELECT key FROM settings WHERE key = 'seeded'")).rows.length) return;
    const stops = [
      ['saddar', 'Saddar', 'Rawalpindi', 33.5965, 73.0528],
      ['committee', 'Committee Chowk', 'Rawalpindi', 33.614, 73.06],
      ['liaquat', 'Liaquat Bagh', 'Rawalpindi', 33.604, 73.066],
      ['faizabad', 'Faizabad', 'Interchange', 33.65, 73.083],
      ['i8', 'I-8 Markaz', 'Islamabad', 33.669, 73.074],
      ['pims', 'PIMS', 'Islamabad', 33.706, 73.048],
      ['centaurus', 'Centaurus', 'Islamabad', 33.707, 73.05],
      ['f6', 'F-6 Markaz', 'Islamabad', 33.731, 73.075],
      ['secretariat', 'Pak Secretariat', 'Islamabad', 33.737, 73.096],
      ['g9', 'G-9 Markaz', 'Islamabad', 33.69, 73.031],
      ['nust', 'NUST Gate 1', 'H-12', 33.641, 72.99],
      ['airport', 'Islamabad Airport', 'Airport', 33.549, 72.825],
    ];
    for (const [id, name, area, lat, lng] of stops)
      await tx.query('INSERT INTO stops(id,name,area,lat,lng) VALUES($1,$2,$3,$4,$5)', [
        id,
        name,
        area,
        lat,
        lng,
      ]);
    const routes = [
      {
        id: 'metro-red',
        code: 'M1',
        name: 'The Capital Line',
        color: '#df6651',
        fare: 50,
        frequency: 10,
        start: 360,
        end: 1260,
        stops: [
          'saddar',
          'liaquat',
          'committee',
          'faizabad',
          'i8',
          'pims',
          'centaurus',
          'secretariat',
        ],
        offsets: [0, 5, 9, 20, 27, 39, 43, 56],
      },
      {
        id: 'city-green',
        code: 'G2',
        name: 'The City Connector',
        color: '#38866b',
        fare: 40,
        frequency: 15,
        start: 390,
        end: 1230,
        stops: ['faizabad', 'i8', 'g9', 'pims', 'f6'],
        offsets: [0, 8, 20, 29, 42],
      },
      {
        id: 'campus-blue',
        code: 'B3',
        name: 'The Campus Link',
        color: '#6684c4',
        fare: 60,
        frequency: 20,
        start: 420,
        end: 1200,
        stops: ['nust', 'g9', 'centaurus', 'f6'],
        offsets: [0, 19, 29, 39],
      },
      {
        id: 'airport-amber',
        code: 'A4',
        name: 'The Airport Express',
        color: '#b78b37',
        fare: 150,
        frequency: 30,
        start: 360,
        end: 1260,
        stops: ['airport', 'nust', 'g9', 'pims'],
        offsets: [0, 35, 51, 62],
      },
    ];
    for (const r of routes) {
      for (const reverse of [false, true]) {
        const id = r.id + (reverse ? '-return' : '');
        await tx.query(
          'INSERT INTO routes(id,code,name,color,fare,status,frequency,start_minute,end_minute) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [
            id,
            r.code + (reverse ? 'R' : ''),
            r.name + (reverse ? ' · Return' : ''),
            r.color,
            r.fare,
            'active',
            r.frequency,
            r.start,
            r.end,
          ],
        );
        const stops = reverse ? [...r.stops].reverse() : r.stops;
        const offsets = reverse
          ? [...r.offsets].reverse().map((x) => r.offsets.at(-1)! - x)
          : r.offsets;
        for (let i = 0; i < stops.length; i++)
          await tx.query(
            'INSERT INTO route_stops(route_id,stop_id,sequence,offset_minutes) VALUES($1,$2,$3,$4)',
            [id, stops[i], i, offsets[i]],
          );
      }
    }
    await tx.query("INSERT INTO settings(key,value) VALUES('seeded','true'),('demo','true')");
    await tx.query(
      "INSERT INTO alerts(id,title,message,severity,route_id,expires_at) VALUES('demo-welcome','A little planning goes a long way','This is a demonstration network. Routes, fares and departure times are illustrative; confirm travel details with your operator.','info',NULL, now() + interval '365 days')",
    );
  });
}
