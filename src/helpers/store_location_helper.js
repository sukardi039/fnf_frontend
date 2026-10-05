export const STORE_RADIUS_METRES = 100;
const EARTH_RADIUS_METRES = 6371000;

const coordinate = (value, limit) => {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim() === "")
  ) return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
};

export const distanceInMetres = (origin, destination) => {
  const lat1 = coordinate(origin.latitude, 90);
  const lon1 = coordinate(origin.longitude, 180);
  const lat2 = coordinate(destination.latitude, 90);
  const lon2 = coordinate(destination.longitude, 180);
  if ([lat1, lon1, lat2, lon2].includes(null)) {
    throw new Error("Invalid GPS coordinates");
  }
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const sinLat = Math.sin(radians(lat2 - lat1) / 2);
  const sinLon = Math.sin(radians(lon2 - lon1) / 2);
  const a =
    sinLat ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * sinLon ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(Math.min(1, a)));
};

export const findNearbyStore = (stores, position) => {
  const candidates = stores
    .filter(
      (store) =>
        store.active !== false &&
        store.storeId &&
        coordinate(store.latitude, 90) !== null &&
        coordinate(store.longitude, 180) !== null,
    )
    .map((store) => ({
      store,
      distance: distanceInMetres(position, store),
    }))
    .filter(({ distance }) => distance <= STORE_RADIUS_METRES)
    .sort((a, b) => a.distance - b.distance);
  return candidates[0] ?? null;
};

export const getCurrentCoordinates = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error("Geolocation is unavailable"), { code: "UNSUPPORTED" }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      reject,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  });
