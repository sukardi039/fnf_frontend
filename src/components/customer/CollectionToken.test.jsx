import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import CollectionToken from "./CollectionToken";
import { issueCustomerArrivalToken, issueCustomerCollectionToken } from "../../helpers/pickup_helper";

vi.mock("../../helpers/pickup_helper", () => ({
  issueCustomerCollectionToken: vi.fn(), issueCustomerArrivalToken: vi.fn(),
}));
vi.mock("react-i18next", () => {
  const t = (key) => key;
  return { useTranslation: () => ({ t }) };
});

describe("customer collection QR", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    issueCustomerCollectionToken.mockResolvedValue({
      data: { transactionId: "TX-1", qrToken: "PRIVATE-TOKEN", expiresAt: new Date(Date.now() + 1000).toISOString() },
    });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("requests an owner token, displays QR and text, and removes both at expiry", async () => {
    const sessionWrite = vi.spyOn(Storage.prototype, "setItem");
    render(<CollectionToken transactionId="TX-1" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "collection.show" })));
    expect(issueCustomerCollectionToken).toHaveBeenCalledWith("TX-1");
    expect(screen.getByRole("img", { name: "collection.qrLabel" })).toBeInTheDocument();
    expect(screen.getByLabelText("collection.token")).toHaveValue("PRIVATE-TOKEN");
    expect(sessionWrite).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1001));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("collection.token")).not.toBeInTheDocument();
    expect(screen.getByText("collection.expired")).toBeInTheDocument();
    sessionWrite.mockRestore();
  });

  it("rejects tokens for another order and already-expired tokens", async () => {
    issueCustomerCollectionToken.mockResolvedValueOnce({
      data: { transactionId: "TX-OTHER", qrToken: "WRONG", expiresAt: new Date(Date.now() + 1000).toISOString() },
    }).mockResolvedValueOnce({
      data: { transactionId: "TX-1", qrToken: "OLD", expiresAt: new Date(Date.now() - 1000).toISOString() },
    });
    render(<CollectionToken transactionId="TX-1" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "collection.show" })));
    expect(screen.getByText("collection.invalidResponse")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "collection.show" })));
    expect(screen.getByText("collection.invalidResponse")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows backend eligibility failures instead of a collection QR", async () => {
    issueCustomerCollectionToken.mockRejectedValue({ response: { data: { message: "Order is not packed" } } });
    render(<CollectionToken transactionId="TX-1" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "collection.show" })));
    expect(screen.getByText("Order is not packed")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("issues purpose-bound arrival proof separately from collection proof and removes it at expiry", async () => {
    issueCustomerArrivalToken.mockResolvedValue({
      data: {
        transactionId: "TX-1", purpose: "ARRIVAL", qrToken: "ARRIVAL-TOKEN",
        expiresAt: new Date(Date.now() + 1000).toISOString(),
      },
    });
    render(<CollectionToken transactionId="TX-1" purpose="arrival" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "arrival.show" })));
    expect(issueCustomerArrivalToken).toHaveBeenCalledWith("TX-1");
    expect(issueCustomerCollectionToken).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "arrival.qrLabel" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText("ARRIVAL-TOKEN")).not.toBeInTheDocument();
    expect(screen.getByText("arrival.present")).toBeInTheDocument();
    expect(screen.getByText("collection.expiresAt")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1001));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("arrival.expired")).toBeInTheDocument();
  });

  it("does not display a collection-purpose token as arrival proof", async () => {
    issueCustomerArrivalToken.mockResolvedValue({
      data: {
        transactionId: "TX-1", purpose: "COLLECTION", qrToken: "WRONG-PURPOSE",
        expiresAt: new Date(Date.now() + 1000).toISOString(),
      },
    });
    render(<CollectionToken transactionId="TX-1" purpose="arrival" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "arrival.show" })));
    expect(screen.getByText("arrival.invalidResponse")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
