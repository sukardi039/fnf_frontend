import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import PickupOrderDetails from "./PickupOrderDetails";
import { pickupOrder } from "./pickupTestData";
import { verifyPickupCollection, handoverPickupOrder } from "../../helpers/pickup_helper";
import { listProducts } from "../catalog/productApi";

vi.mock("../catalog/productApi", () => ({ listProducts: vi.fn() }));
vi.mock("@mui/icons-material", () => ({ Inventory2: () => <span>Product placeholder</span> }));
vi.mock("../../helpers/file_helper", () => ({
  getDisplayImageInfo: (picture) => ({ imageUrl: picture }), ThumbnailImg: () => null,
}));

vi.mock("../../helpers/pickup_helper", () => ({
  allocatePickupLots: vi.fn(), preparePickupOrder: vi.fn(),
  verifyPickupCollection: vi.fn(), handoverPickupOrder: vi.fn(),
}));
vi.mock("../../helpers/camera_scanner_helper", () => ({
  useCameraScanner: ({ onScan }) => ({
    scannerOpen: false, scannerOverlay: null, openScanner: () => onScan("SCANNED-COLLECTION-QR"),
  }),
}));
vi.mock("react-i18next", () => {
  const t = (key) => key;
  return { useTranslation: () => ({ t }) };
});

describe("pickup collection eligibility", () => {
  beforeEach(() => {
    listProducts.mockResolvedValue({ data: { items: [], total: 0 } });
  });

  it("adds the shared catalog thumbnail before pickup product names without changing allocations", async () => {
    const line = pickupOrder.items[0];
    listProducts.mockResolvedValue({ data: { total: 1, items: [
      { skuId: line.skuId, productPicture: "https://images.example/pickup-fruit.jpg" },
    ] } });
    render(<PickupOrderDetails order={pickupOrder}
      onChanged={vi.fn()} onClose={vi.fn()} onBusyChange={vi.fn()} />);
    const image = await screen.findByRole("img", { name: line.productName });
    expect(image).toHaveAttribute("src", "https://images.example/pickup-fruit.jpg");
    expect(image.compareDocumentPosition(screen.getByText(line.productName)) &
      Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(`${line.skuId}: ${line.quantity} ${line.uom}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "pickup.saveAllocations" })).toBeInTheDocument();
  });
  it.each([
    { fulfilmentHoldReason: "QUALITY_REVIEW" },
    { fulfilmentHoldReason: "LATE_PAYMENT" },
    { paymentResolutionStatus: "CHECKING" },
  ])("blocks even stale collection action flags while held or resolving: %j", async (fields) => {
    render(<PickupOrderDetails order={{ ...pickupOrder, ...fields, preparationStatus: "READY",
      actions: { canAllocateLots: false, canStartPreparation: false, canMarkReady: false, canHandover: true },
    }} onChanged={vi.fn()} onClose={vi.fn()} onBusyChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "pickup.verify" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "pickup.scanCollection" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "pickup.confirmHandover" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "pickup.verify" }));
    expect(verifyPickupCollection).not.toHaveBeenCalled();
    await act(async () => {});
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });

  it("invalidates verification when the token expires or its text changes", async () => {
    vi.useFakeTimers();
    verifyPickupCollection.mockImplementation(async () => ({
      data: {
        transactionId: "TX-1", storeId: "STORE-1", verified: true,
        expiresAt: new Date(Date.now() + 1000).toISOString(),
      },
    }));
    render(
      <PickupOrderDetails
        order={{
          ...pickupOrder, preparationStatus: "READY",
          actions: { canAllocateLots: false, canStartPreparation: false, canMarkReady: false, canHandover: true },
        }}
        onChanged={vi.fn()} onClose={vi.fn()} onBusyChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("pickup.collectionToken");
    const verify = screen.getByRole("button", { name: "pickup.verify" });
    const handover = screen.getByRole("button", { name: "pickup.confirmHandover" });
    expect(handover).toBeDisabled();
    fireEvent.change(input, { target: { value: "TOKEN" } });
    await act(async () => fireEvent.click(verify));
    expect(handover).toBeEnabled();
    act(() => vi.advanceTimersByTime(1001));
    expect(handover).toBeDisabled();
    await act(async () => fireEvent.click(verify));
    expect(handover).toBeEnabled();
    fireEvent.change(input, { target: { value: "OTHER-TOKEN" } });
    expect(handover).toBeDisabled();
    expect(handoverPickupOrder).not.toHaveBeenCalled();
  });

  it("camera scanning fills collection proof without automatically verifying or releasing goods", async () => {
    render(<PickupOrderDetails order={{ ...pickupOrder, preparationStatus: "READY",
      actions: { canAllocateLots: false, canStartPreparation: false, canMarkReady: false, canHandover: true },
    }} onChanged={vi.fn()} onClose={vi.fn()} onBusyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "pickup.scanCollection" }));
    expect(screen.getByLabelText("pickup.collectionToken")).toHaveValue("SCANNED-COLLECTION-QR");
    expect(screen.getByRole("button", { name: "pickup.confirmHandover" })).toBeDisabled();
    expect(verifyPickupCollection).not.toHaveBeenCalled();
    expect(handoverPickupOrder).not.toHaveBeenCalled();
    await act(async () => {});
  });
});
