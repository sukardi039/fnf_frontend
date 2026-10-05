import { describe, expect, it, vi, afterEach } from "vitest";
import {
  distanceInMetres,
  findNearbyStore,
  getCurrentCoordinates,
  STORE_RADIUS_METRES,
} from "./store_location_helper";

const origin = { latitude: 0, longitude: 0 };
const atDistance = (metres) => ({
  latitude: (metres / 6371000) * (180 / Math.PI),
  longitude: 0,
});
const store = (storeId, metres, extra = {}) => ({
  storeId, ...atDistance(metres), active: true, ...extra,
});

afterEach(() => vi.unstubAllGlobals());

describe("GPS store distance", () => {
  it("measures great-circle distance in metres", () => {
    expect(distanceInMetres(origin, atDistance(100))).toBeCloseTo(100, 8);
    expect(distanceInMetres(origin, origin)).toBe(0);
    expect(distanceInMetres(
      { latitude: 0, longitude: 179.9999 },
      { latitude: 0, longitude: -179.9999 },
    )).toBeCloseTo(22.239, 2);
  });

  it("includes the 100-metre boundary but excludes stores beyond it", () => {
    expect(STORE_RADIUS_METRES).toBe(100);
    expect(findNearbyStore([store("boundary", 100)], origin)?.store.storeId).toBe("boundary");
    expect(findNearbyStore([store("outside", 100.001)], origin)).toBeNull();
    expect(findNearbyStore([store("inside", 99.999)], origin)?.store.storeId).toBe("inside");
  });

  it("chooses the nearest eligible store rather than the first or only store", () => {
    expect(findNearbyStore([store("far", 90), store("near", 20)], origin)?.store.storeId).toBe("near");
    expect(findNearbyStore([store("only", 200)], origin)).toBeNull();
  });

  it("ignores inactive stores and missing or invalid store coordinates", () => {
    const stores = [
      store("inactive", 1, { active: false }),
      store("missing", 1, { latitude: null }),
      store("empty", 1, { longitude: "" }),
      store("whitespace", 1, { longitude: " " }),
      store("boolean", 1, { latitude: true }),
      store("array", 1, { latitude: [] }),
      store("invalid", 1, { latitude: 91 }),
      store("invalidLon", 1, { longitude: 181 }),
      store("nan", 1, { longitude: "not a coordinate" }),
      store("valid", 50),
    ];
    expect(findNearbyStore(stores, origin)?.store.storeId).toBe("valid");
    expect(findNearbyStore([], origin)).toBeNull();
  });

  it("accepts zero and numeric string coordinates but rejects invalid device coordinates", () => {
    expect(findNearbyStore([store("zero", 0, { latitude: "0", longitude: "0" })], origin)?.store.storeId).toBe("zero");
    expect(() => distanceInMetres({ latitude: null, longitude: 0 }, origin)).toThrow("Invalid GPS coordinates");
  });
});

describe("fresh device coordinates", () => {
  it("requests high accuracy with no cached position and a bounded timeout", async () => {
    const getCurrentPosition = vi.fn((success) => success({ coords: origin }));
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    await expect(getCurrentCoordinates()).resolves.toEqual(origin);
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function), expect.any(Function),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  });

  it("reports unsupported geolocation and preserves permission/timeout errors", async () => {
    vi.stubGlobal("navigator", {});
    await expect(getCurrentCoordinates()).rejects.toMatchObject({ code: "UNSUPPORTED" });
    for (const code of [1, 2, 3]) {
      vi.stubGlobal("navigator", {
        geolocation: { getCurrentPosition: (_success, failure) => failure({ code }) },
      });
      await expect(getCurrentCoordinates()).rejects.toMatchObject({ code });
    }
  });
});
