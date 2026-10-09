import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StoreForm from "./StoreForm";
import { createStore, getStore, updateStore } from "../../helpers/store_api";
import { emptyBusinessHours } from "../../helpers/store_hours_helper";

vi.mock("../../helpers/store_api", () => ({
  createStore: vi.fn(), getStore: vi.fn(), updateStore: vi.fn(),
}));
vi.mock("@mui/icons-material", () => ({ MyLocation: () => null }));
vi.mock("../common", () => ({ HeaderBar: () => null }));
vi.mock("react-i18next", () => {
  const t = (key, values) => values ? `${key} ${Object.values(values).join(" ")}` : key;
  return { useTranslation: () => ({ t }) };
});

const store = {
  storeId: "STORE-1", storeName: "Test store", companyId: "COMPANY-1",
  timezone: "Asia/Singapore", businessHours: emptyBusinessHours(),
};
const dayGroup = (day) => within(screen.getByRole("group", { name: `storeList.weekdays.${day}` }));
const setIntervalTimes = (day, index, opensAt, closesAt) => {
  fireEvent.change(dayGroup(day).getAllByLabelText("storeList.opensAt")[index], { target: { value: opensAt } });
  fireEvent.change(dayGroup(day).getAllByLabelText("storeList.closesAt")[index], { target: { value: closesAt } });
};

describe("store weekly business hours", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createStore.mockResolvedValue({ data: {} });
    updateStore.mockResolvedValue({ data: {} });
    getStore.mockImplementation(async () => ({
      data: { ...store, businessHours: updateStore.mock.calls.at(-1)?.[1].businessHours ||
        createStore.mock.calls.at(-1)?.[0].businessHours },
    }));
  });
  afterEach(cleanup);

  it("edits split and overnight shifts and verifies persisted hours before closing", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<StoreForm store={store} onCancel={onCancel} />);
    await user.click(dayGroup("MONDAY").getByRole("button", { name: /storeList.addHours/ }));
    setIntervalTimes("MONDAY", 0, "09:00", "12:00");
    await user.click(dayGroup("MONDAY").getByRole("button", { name: /storeList.addHours/ }));
    setIntervalTimes("MONDAY", 1, "14:00", "22:00");
    await user.click(dayGroup("FRIDAY").getByRole("button", { name: /storeList.addHours/ }));
    setIntervalTimes("FRIDAY", 0, "20:00", "03:00");
    await user.click(screen.getByRole("button", { name: "basic.save" }));
    await waitFor(() => expect(onCancel).toHaveBeenCalledWith(true));
    expect(updateStore).toHaveBeenCalledWith("STORE-1", expect.objectContaining({
      businessHours: { ...emptyBusinessHours(),
        MONDAY: [{ opensAt: "09:00", closesAt: "12:00" }, { opensAt: "14:00", closesAt: "22:00" }],
        FRIDAY: [{ opensAt: "20:00", closesAt: "03:00" }],
      },
    }));
    expect(getStore).toHaveBeenCalledWith("STORE-1");
  });

  it("sends seven-day hours when creating a store", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<StoreForm onCancel={onCancel} />);
    fireEvent.change(screen.getByLabelText(/storeList.storeId/), { target: { value: "STORE-1" } });
    fireEvent.change(screen.getByLabelText(/storeList.storeName/), { target: { value: "New store" } });
    fireEvent.change(screen.getByLabelText(/storeList.companyId/), { target: { value: "COMPANY-1" } });
    await user.click(dayGroup("TUESDAY").getByRole("button", { name: /storeList.addHours/ }));
    setIntervalTimes("TUESDAY", 0, "10:00", "20:00");
    await user.click(screen.getByRole("button", { name: "basic.save" }));
    await waitFor(() => expect(onCancel).toHaveBeenCalledWith(true));
    expect(createStore).toHaveBeenCalledWith(expect.objectContaining({
      businessHours: { ...emptyBusinessHours(), TUESDAY: [{ opensAt: "10:00", closesAt: "20:00" }] },
    }));
  });

  it("removes an interval to mark a day closed", async () => {
    const user = userEvent.setup();
    render(<StoreForm store={{ ...store, businessHours: {
      ...emptyBusinessHours(), MONDAY: [{ opensAt: "09:00", closesAt: "22:00" }],
    } }} onCancel={vi.fn()} />);
    await user.click(dayGroup("MONDAY").getByRole("button", { name: /storeList.removeHours/ }));
    expect(dayGroup("MONDAY").getByText("storeList.closed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "basic.save" }));
    await waitFor(() => expect(updateStore).toHaveBeenCalled());
    expect(updateStore.mock.calls[0][1].businessHours.MONDAY).toEqual([]);
  });

  it("rejects overlapping overnight hours without saving", async () => {
    const user = userEvent.setup();
    render(<StoreForm store={{ ...store, businessHours: {
      ...emptyBusinessHours(), SUNDAY: [{ opensAt: "20:00", closesAt: "03:00" }],
      MONDAY: [{ opensAt: "02:00", closesAt: "10:00" }],
    } }} onCancel={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "basic.save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("storeList.hoursOverlap");
    expect(updateStore).not.toHaveBeenCalled();
  });

  it("does not report success or repeat creation if the backend ignores hours", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    getStore.mockResolvedValue({ data: { ...store, businessHours: undefined } });
    render(<StoreForm store={store} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "basic.save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("storeList.hoursUnconfirmed");
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "basic.save" })).toBeDisabled();
  });
});
