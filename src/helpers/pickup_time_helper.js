const partsAt = (date, timeZone) => Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal")
    .map((part) => [part.type, Number(part.value)]),
);

const asUtc = (parts) => Date.UTC(
  parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second,
);

const instantFor = (year, month, day, minute, timeZone) => {
  const target = Date.UTC(year, month - 1, day, Math.floor(minute / 60), minute % 60);
  let instant = target;
  for (let index = 0; index < 4; index += 1) {
    const difference = target - asUtc(partsAt(new Date(instant), timeZone));
    if (difference === 0) return new Date(instant);
    instant += difference;
  }
  throw new Error("Invalid pickup time in store timezone");
};

export const getPickupSlots = (now, timeZone, businessHours) => {
  if (!timeZone) throw new Error("Store timezone is required");
  validateBusinessHours(businessHours);
  const today = partsAt(now, timeZone);
  const earliest = now.getTime() + 90 * 60 * 1000;
  const date = new Date(Date.UTC(today.year, today.month - 1, today.day));
  const intervals = [-1, 0].flatMap((offset) => {
    const day = new Date(date.getTime() + offset * 24 * 60 * 60 * 1000);
    const weekday = WEEKDAYS[(day.getUTCDay() + 6) % 7];
    return businessHours[weekday].map((period) => {
      const open = timeMinutes(period.opensAt);
      const close = timeMinutes(period.closesAt);
      return {
        start: instantFor(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), open, timeZone).getTime(),
        end: instantFor(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(),
          close + (close < open ? 1440 : 0), timeZone).getTime(),
      };
    });
  });
  const slots = [];
  const roundedMinute = Math.ceil(earliest / 60000) * 60000;
  const localMinute = partsAt(new Date(roundedMinute), timeZone).minute;
  const first = roundedMinute + ((30 - localMinute % 30) % 30) * 60000;
  for (let instant = first; instant <= earliest + 26 * 60 * 60 * 1000; instant += 30 * 60 * 1000) {
    const start = new Date(instant);
    const local = partsAt(start, timeZone);
    if (local.minute % 30 !== 0) continue;
    if (!intervals.some((period) => instant >= period.start &&
        instant + 60 * 60 * 1000 <= period.end)) continue;
    slots.push({
      pickupSlotStart: start.toISOString(),
      pickupSlotEnd: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
      pickupExpiresAt: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
      pickupTimezone: timeZone,
    });
  }
  return slots;
};

export const formatPickupTime = (value, timeZone, relativeTo) => {
  const time = new Intl.DateTimeFormat(undefined, {
    timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(value));
  if (!relativeTo) return time;
  const date = partsAt(new Date(value), timeZone);
  const reference = partsAt(new Date(relativeTo), timeZone);
  if (date.year === reference.year && date.month === reference.month && date.day === reference.day) return time;
  return `${time} (${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")})`;
};

export const formatPickupSlot = (slot) =>
  `${formatPickupTime(slot.pickupSlotStart, slot.pickupTimezone)} - ${
    formatPickupTime(slot.pickupSlotEnd, slot.pickupTimezone, slot.pickupSlotStart)}`;

export const formatPickupSlotWithDate = (slot) =>
  `${new Intl.DateTimeFormat(undefined, {
    timeZone: slot.pickupTimezone, month: "short", day: "numeric",
  }).format(new Date(slot.pickupSlotStart))} ${formatPickupSlot(slot)}`;
import { timeMinutes, validateBusinessHours, WEEKDAYS } from "./store_hours_helper";
