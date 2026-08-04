export const APP_TIME_ZONE = "Europe/Berlin";

export function formatBerlinDateTime(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: APP_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatBerlinTime(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

// datetime-local enthält absichtlich keine Zeitzone. Diese Funktion behandelt den
// eingegebenen Wert immer als deutsche Ortszeit und berücksichtigt CET/CEST.
export function berlinLocalToIso(value: string) {
  if (!value) return "";
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second = 0] = timePart.split(":").map(Number);
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let i = 0; i < 3; i += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIME_ZONE,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(guess));
    const get = (type: string) => Number(parts.find(part => part.type === type)?.value || 0);
    const represented = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    guess += Date.UTC(year, month - 1, day, hour, minute, second) - represented;
  }
  return new Date(guess).toISOString();
}

export function isoToBerlinLocalInput(value?: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(part => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
