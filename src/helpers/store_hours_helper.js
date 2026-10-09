export const WEEKDAYS = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
];

export const emptyBusinessHours = () => Object.fromEntries(WEEKDAYS.map((day) => [day, []]));

export const timeMinutes = (value) => {
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error("storeList.hoursInvalid");
  }
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
};

export const validateBusinessHours = (hours) => {
  if (!hours || typeof hours !== "object" || Array.isArray(hours) ||
      Object.keys(hours).length !== 7 || !WEEKDAYS.every((day) => Array.isArray(hours[day]))) {
    throw new Error("storeList.hoursInvalid");
  }
  const intervals = [];
  WEEKDAYS.forEach((day, index) => {
    hours[day].forEach((period) => {
      if (!period || typeof period !== "object") throw new Error("storeList.hoursInvalid");
      const open = timeMinutes(period.opensAt);
      const close = timeMinutes(period.closesAt);
      if (open === close) throw new Error("storeList.hoursInvalid");
      const start = index * 1440 + open;
      const end = index * 1440 + close + (close < open ? 1440 : 0);
      intervals.push({ start, end });
    });
  });
  const week = 7 * 1440;
  const repeated = intervals.flatMap(({ start, end }) => [
    { start, end }, { start: start + week, end: end + week },
  ]).sort((left, right) => left.start - right.start);
  for (let index = 1; index < repeated.length; index += 1) {
    if (repeated[index].start < repeated[index - 1].end) {
      throw new Error("storeList.hoursOverlap");
    }
  }
  return hours;
};
