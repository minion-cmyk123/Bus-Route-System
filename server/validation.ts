import { z } from 'zod';
const short = (max: number) => z.string().trim().min(1).max(max);
export const idSchema = z.object({ id: short(100) });
export const signupSchema = z
  .object({
    name: short(80),
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
export const loginSchema = signupSchema
  .omit({ name: true })
  .extend({ password: z.string().min(1).max(128) });
export const stopSchema = z
  .object({
    name: short(100),
    area: short(80),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accessible: z.boolean(),
  })
  .strict();
export const routeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Z0-9-]{1,10}$/),
    name: short(100),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    fare: z.number().int().min(0).max(10000),
    status: z.enum(['active', 'delayed', 'suspended']),
    frequency: z.number().int().min(1).max(180),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(0).max(1439),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    accessible: z.boolean(),
    stops: z
      .array(z.object({ id: short(100), offset: z.number().int().min(0).max(1439) }).strict())
      .min(2)
      .max(50),
    version: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (r.endMinute < r.startMinute) issue('Service end must be after service start.');
    if (r.stops[0].offset !== 0) issue('First stop offset must be zero.');
    if (r.stops.some((s, i) => i > 0 && s.offset <= r.stops[i - 1].offset))
      issue('Stop offsets must increase.');
    if (new Set(r.stops.map((s) => s.id)).size !== r.stops.length)
      issue('A stop cannot appear twice on a route.');
    if (new Set(r.days).size !== r.days.length) issue('Service days must be unique.');
    if (r.endMinute + r.stops.at(-1)!.offset > 1439)
      issue('Last trip must finish before midnight.');
  });
export const alertSchema = z
  .object({
    title: short(120),
    message: short(1000),
    severity: z.enum(['info', 'warning', 'critical']),
    routeId: short(100).nullable(),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export const journeySchema = z
  .object({
    from: short(100),
    to: short(100),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    accessible: z.enum(['true', 'false']).default('false'),
  })
  .strict()
  .refine((s) => s.from !== s.to, 'Choose two different stops.');
export const savedSchema = z
  .object({ fromId: short(100), toId: short(100), label: short(80) })
  .strict()
  .refine((s) => s.fromId !== s.toId, 'Choose two different stops.');
