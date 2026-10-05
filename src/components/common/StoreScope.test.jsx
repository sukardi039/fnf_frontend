import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/authContext";
import { useStoreLocation } from "../../context/storeLocationContext";
import { listStores } from "../../helpers/store_api";
import { getCurrentCoordinates } from "../../helpers/store_location_helper";
import StoreScope from "./StoreScope";
import AppHome from "../AppHome";
import { getDailySummary } from "../../helpers/reporting_helper";
import { listInventorySnapshots } from "../../helpers/inventory_helper";
import translations from "../../locales/en/translation.json";

vi.mock("../../helpers/store_api", () => ({ listStores: vi.fn() }));
vi.mock("@mui/icons-material", () => ({
  PointOfSale: () => null,
  LocalOffer: () => null,
  Inventory: () => null,
  Warning: () => null,
}));
vi.mock("../../helpers/reporting_helper", () => ({ getDailySummary: vi.fn() }));
vi.mock("../../helpers/inventory_helper", () => ({ listInventorySnapshots: vi.fn() }));
vi.mock("../catalog/productApi", () => ({
  listPriceRules: vi.fn().mockResolvedValue({ data: { items: [] } }),
}));
vi.mock("../../helpers/store_location_helper", async (importOriginal) => ({
  ...await importOriginal(),
  getCurrentCoordinates: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate, i18n: { language: "en" } }),
}));

function translate(key, params = {}) {
  const text = key.split(".").reduce((value, part) => value?.[part], translations);
  return String(text ?? key).replace(/\{\{(\w+)\}\}/g, (_match, name) => params[name] ?? "");
}

const stores = [
  { storeId: "near", storeName: "Nearby Store", latitude: 0, longitude: 0, active: true },
  { storeId: "far", storeName: "Remote Store", latitude: 1, longitude: 1, active: true },
];

function StoreData() {
  const { storeId, source } = useStoreLocation();
  const [value, setValue] = useState("");
  return (
    <div>
      <span data-testid="scope">{storeId}:{source}</span>
      <input aria-label="Store form" value={value} onChange={(event) => setValue(event.target.value)} />
    </div>
  );
}

function Navigation() {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/reports/daily-summary")}>Navigate</button>;
}

function setup(companyId = "company", pathname = "/home", children = <StoreData />) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AuthContext.Provider value={{ userInfo: { companyId, storeId: "far" } }}>
        <Navigation />
        <StoreScope>{children}</StoreScope>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

async function selectStore(name) {
  await userEvent.click(screen.getByRole("combobox"));
  await userEvent.click(await screen.findByRole("option", { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  listStores.mockResolvedValue({ data: { items: stores } });
  getCurrentCoordinates.mockResolvedValue({ latitude: 0, longitude: 0 });
  getDailySummary.mockResolvedValue({ data: {
    grossSales: { amount: 123, currency: "MYR" },
    netSales: { amount: 120, currency: "MYR" },
    shrinkageCost: { amount: 3, currency: "MYR" },
    recoverySales: { amount: 10, currency: "MYR" },
    paymentSuccessRate: 1,
  } });
  listInventorySnapshots.mockResolvedValue({ data: { items: [] } });
});
afterEach(cleanup);

describe("GPS-first store scope", () => {
  it("selects GPS instead of the session store and scopes the active store lookup", async () => {
    setup();
    expect(await screen.findByTestId("scope")).toHaveTextContent("near:gps");
    expect(listStores).toHaveBeenCalledWith({ companyId: "company", active: true });
    expect(screen.getByText(/GPS store: Nearby Store/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("does not mount store data until GPS has resolved", async () => {
    let resolve;
    getCurrentCoordinates.mockReturnValue(new Promise((done) => { resolve = done; }));
    setup();
    await waitFor(() => expect(getCurrentCoordinates).toHaveBeenCalled());
    expect(screen.queryByTestId("scope")).not.toBeInTheDocument();
    resolve({ latitude: 0, longitude: 0 });
    expect(await screen.findByTestId("scope")).toHaveTextContent("near:gps");
  });

  it.each([
    [1, /permission was denied/],
    [2, /location is unavailable/],
    [3, /timed out/],
    ["UNSUPPORTED", /does not support/],
  ])("offers explicit manual fallback for GPS error %s", async (code, message) => {
    getCurrentCoordinates.mockRejectedValue({ code });
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByTestId("scope")).not.toBeInTheDocument();
    await selectStore("Remote Store");
    expect(screen.getByTestId("scope")).toHaveTextContent("far:manual");
  });

  it("does not auto-select even a single store outside 100 metres", async () => {
    listStores.mockResolvedValue({ data: [stores[1]] });
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent(/within 100 metres/);
    expect(screen.queryByTestId("scope")).not.toBeInTheDocument();
    await selectStore("Remote Store");
    expect(screen.getByTestId("scope")).toHaveTextContent("far:manual");
  });

  it("resets store-specific forms when the manual selection changes", async () => {
    getCurrentCoordinates.mockRejectedValue({ code: 1 });
    setup();
    await screen.findByRole("combobox");
    await selectStore("Nearby Store");
    fireEvent.change(screen.getByLabelText("Store form"), { target: { value: "old store data" } });
    await selectStore("Remote Store");
    expect(screen.getByLabelText("Store form")).toHaveValue("");
    expect(screen.getByTestId("scope")).toHaveTextContent("far:manual");
  });

  it("clears the old store on GPS retry and identifies the store again", async () => {
    setup();
    await screen.findByTestId("scope");
    getCurrentCoordinates.mockResolvedValue({ latitude: 1, longitude: 1 });
    await userEvent.click(screen.getByRole("button", { name: "Retry GPS store lookup" }));
    expect(await screen.findByTestId("scope")).toHaveTextContent("far:gps");
    expect(getCurrentCoordinates).toHaveBeenCalledTimes(2);
  });

  it("uses a fresh GPS lookup when navigating to another store-related screen", async () => {
    setup();
    await screen.findByTestId("scope");
    getCurrentCoordinates.mockResolvedValue({ latitude: 1, longitude: 1 });
    await userEvent.click(screen.getByRole("button", { name: "Navigate" }));
    await waitFor(() => expect(screen.getByTestId("scope")).toHaveTextContent("far:gps"));
    expect(getCurrentCoordinates).toHaveBeenCalledTimes(2);
  });

  it("reports store-list errors without silently selecting a session store", async () => {
    listStores.mockRejectedValue(new Error("Service unavailable"));
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable");
    expect(screen.queryByTestId("scope")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(getCurrentCoordinates).not.toHaveBeenCalled();
  });

  it.each(["/m/cart", "/tv/projects"])("does not use the web session company on %s", async (pathname) => {
    setup("web-company", pathname);
    await screen.findByTestId("scope");
    expect(listStores).toHaveBeenCalledWith({ companyId: undefined, active: true });
  });

  it("passes the GPS store to both real dashboard data requests, not the assigned store", async () => {
    setup("company", "/home", <AppHome />);
    expect(await screen.findByText("MYR 123.00")).toBeInTheDocument();
    expect(getDailySummary).toHaveBeenCalledWith({
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), storeId: "near",
    });
    expect(listInventorySnapshots).toHaveBeenCalledWith({
      storeId: "near", page: 0, pageSize: 100,
    });
  });

  it("does not fetch dashboard store data while awaiting manual fallback", async () => {
    getCurrentCoordinates.mockRejectedValue({ code: 1 });
    setup("company", "/home", <AppHome />);
    await screen.findByRole("combobox");
    expect(getDailySummary).not.toHaveBeenCalled();
    expect(listInventorySnapshots).not.toHaveBeenCalled();
    await selectStore("Remote Store");
    await waitFor(() => expect(getDailySummary).toHaveBeenCalledWith({
      date: expect.any(String), storeId: "far",
    }));
    expect(listInventorySnapshots).toHaveBeenCalledWith({
      storeId: "far", page: 0, pageSize: 100,
    });
  });

  it("reports malformed store responses rather than treating them as an empty list", async () => {
    listStores.mockResolvedValue({ data: { unexpected: [] } });
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid store list/);
    expect(getCurrentCoordinates).not.toHaveBeenCalled();
  });
});
