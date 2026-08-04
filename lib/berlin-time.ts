const BERLIN = "Europe/Berlin";

export function berlinLocalToIso(value: string): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return new Date(value).toISOString();
  const [, y, mo, d, h, mi] = match;
  const wanted = { year:+y, month:+mo, day:+d, hour:+h, minute:+mi };
  let guess = Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute);
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: BERLIN, year:"numeric", month:"2-digit", day:"2-digit",
      hour:"2-digit", minute:"2-digit", hourCycle:"h23"
    }).formatToParts(new Date(guess));
    const get = (type:string) => Number(parts.find(p => p.type === type)?.value || 0);
    const rendered = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    const desired = Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute);
    guess += desired - rendered;
  }
  return new Date(guess).toISOString();
}

export function isoToBerlinInput(value?: string | null): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BERLIN, year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", hourCycle:"h23"
  }).formatToParts(new Date(value));
  const get = (type:string) => parts.find(p => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function formatBerlin(value: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: BERLIN, ...options }).format(new Date(value));
}
