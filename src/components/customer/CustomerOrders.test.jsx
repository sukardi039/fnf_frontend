import React from "react";
import PropTypes from "prop-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CustomerOrders from "./CustomerOrders";
import { listAllCustomerTransactions } from "../../helpers/customer_cart_helper";
import { listProducts } from "../catalog/productApi";

vi.mock("../catalog/productApi", () => ({ listProducts: vi.fn() }));

vi.mock("../../helpers/customer_cart_helper", async (importOriginal) => ({
  ...await importOriginal(), listAllCustomerTransactions: vi.fn(),
}));
vi.mock("../../helpers/customer_helper", () => ({ getCustomerInfo: () => ({ customerId: "CUSTOMER-1" }) }));
vi.mock("../../helpers/pickup_helper", () => ({
  issueCustomerCollectionToken: vi.fn(), issueCustomerArrivalToken: vi.fn(),
}));
vi.mock("@mui/icons-material", () => ({ Inventory2: () => <span>Product placeholder</span> }));
vi.mock("../../helpers/file_helper", () => ({
  getDisplayImageInfo: (picture) => typeof picture === "string" ? { imageUrl: picture } : { meta: picture },
  ThumbnailImg: ThumbnailMock,
}));
function ThumbnailMock({ alt, fileId }) {
  return <img alt={alt} src={`https://files.example/${fileId}`} />;
}
ThumbnailMock.propTypes = { alt: PropTypes.string, fileId: PropTypes.string };
vi.mock("../common", () => {
  const EmptyState = ({ title, description }) => <div>{title}{description}</div>;
  EmptyState.propTypes = { title: PropTypes.string, description: PropTypes.string };
  return { LoadingState: () => <span>Loading</span>, EmptyState };
});
vi.mock("react-i18next", () => {
  const t = (key) => key;
  return { useTranslation: () => ({ t }) };
});

describe("customer pickup history", () => {
  beforeEach(() => {
    listProducts.mockResolvedValue({ data: { items: [], total: 0 } });
  });
  it("offers late collection only for active paid orders without holds", async () => {
    listAllCustomerTransactions.mockResolvedValue([
      { transactionId: "PAID", channel: "MOBILE_ORDER", state: "READY_FOR_HANDOVER",
        paymentStatus: "SUCCESS", preparationStatus: "READY", pickupTimingStatus: "OVERDUE",
        pickupSlotStart: "2026-10-09T10:00:00Z", pickupSlotEnd: "2026-10-09T10:30:00Z",
        pickupExpiresAt: "2026-10-09T11:00:00Z", pickupTimezone: "Asia/Singapore" },
      { transactionId: "HELD", channel: "MOBILE_ORDER", state: "READY_FOR_HANDOVER",
        paymentStatus: "SUCCESS", preparationStatus: "READY", fulfilmentHoldReason: "LATE_PAYMENT" },
      { transactionId: "CHECKING", channel: "MOBILE_ORDER", state: "PAYMENT_PENDING",
        paymentResolutionStatus: "CHECKING" },
      { transactionId: "LEGACY", channel: "MOBILE_ORDER", state: "EXPIRED", paymentStatus: "SUCCESS" },
    ]);
    render(<CustomerOrders />);
    expect(await screen.findByText(/pickup.overduePaid/)).toBeInTheDocument();
    expect(screen.getByText("customer.orders.collectionDue")).toBeInTheDocument();
    expect(screen.getByText("pickup.latePaymentHold")).toBeInTheDocument();
    expect(screen.getByText("pickup.paymentChecking")).toBeInTheDocument();
    expect(screen.getByText("pickup.paidExpiredReview")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "collection.show" })).toHaveLength(1);
    expect(screen.queryByText("customer.orders.expired")).not.toBeInTheDocument();
  });
  afterEach(() => { cleanup(); vi.resetAllMocks(); });

  it("shows preparation and collection actions only for eligible mobile orders", async () => {
    listAllCustomerTransactions.mockResolvedValue([
        { transactionId: "MOBILE-1", channel: "MOBILE_ORDER", preparationStatus: "READY", state: "READY_FOR_HANDOVER", currency: "MYR", amount: 5 },
        { transactionId: "COUNTER-1", channel: "STAFF_ASSISTED", state: "READY_FOR_HANDOVER", currency: "MYR", amount: 5 },
        { transactionId: "COLLECTED-1", channel: "MOBILE_ORDER", state: "HANDED_OVER", currency: "MYR", amount: 5 },
      ]);
    render(<CustomerOrders />);
    expect(await screen.findByText("pickup.status.READY")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "collection.show" })).toHaveLength(1);
    const mobileCard = screen.getByText("MOBILE-1").closest(".MuiCard-root");
    expect(within(mobileCard).getByRole("button", { name: "collection.show" })).toBeInTheDocument();
    expect(screen.queryByText("COLLECTED-1")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "customer.orders.past" }));
    expect(screen.getByText("COLLECTED-1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "collection.show" })).not.toBeInTheDocument();
  });

  it("sorts and paginates each view independently and resets the page when switching or refreshing", async () => {
    listAllCustomerTransactions.mockResolvedValue(Array.from({ length: 42 }, (_, index) => ({
      transactionId: `ORDER-${index}`,
      state: index % 2 === 0 ? "PAYMENT_PENDING" : "HANDED_OVER",
      createdAt: new Date(Date.UTC(2026, 9, 1, index)).toISOString(),
    })));
    const user = userEvent.setup();
    render(<CustomerOrders />);
    expect(await screen.findByText("ORDER-40")).toBeInTheDocument();
    expect(screen.getAllByText(/^ORDER-/)[0]).toHaveTextContent("ORDER-40");
    expect(screen.queryByText("ORDER-0")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "pickup.next" }));
    expect(screen.getByText("ORDER-0")).toBeInTheDocument();
    expect(listAllCustomerTransactions).toHaveBeenLastCalledWith("CUSTOMER-1");
    expect(listAllCustomerTransactions).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("tab", { name: "customer.orders.past" }));
    expect(screen.getAllByText(/^ORDER-/)[0]).toHaveTextContent("ORDER-41");
    expect(screen.queryByText("ORDER-1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "pickup.previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "pickup.next" }));
    expect(screen.getByText("ORDER-1")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "pickup.refresh" }));
    expect(await screen.findByText("ORDER-41")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "customer.orders.past" })).toHaveAttribute("aria-selected", "true");
    expect(listAllCustomerTransactions).toHaveBeenCalledTimes(2);
  });

  it("shows arrival proof only for unpaid cash pickup awaiting arrival, not collection proof", async () => {
    listAllCustomerTransactions.mockResolvedValue([
        {
          transactionId: "CASH-1", channel: "MOBILE_ORDER", paymentMode: "PAY_AT_COUNTER",
          state: "CASH_PENDING_CONFIRMATION", arrivalStatus: "EXPECTED",
          preparationStatus: "NOT_STARTED", currency: "MYR", amount: 5,
        },
        {
          transactionId: "CASH-2", channel: "MOBILE_ORDER", paymentMode: "PAY_AT_COUNTER",
          state: "CASH_PENDING_CONFIRMATION", arrivalStatus: "ARRIVED",
          preparationStatus: "NOT_STARTED", currency: "MYR", amount: 5,
        },
      ]);
    render(<CustomerOrders />);
    expect(await screen.findByRole("button", { name: "arrival.show" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "arrival.show" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "collection.show" })).not.toBeInTheDocument();
    expect(screen.getByText("pickup.arrived")).toBeInTheDocument();
  });

  it("shows the scheduled deadline and does not describe expired orders as awaiting preparation", async () => {
    listAllCustomerTransactions.mockResolvedValue([{
      transactionId: "EXPIRED-1", channel: "MOBILE_ORDER", paymentMode: "PAY_AT_COUNTER",
      state: "EXPIRED", preparationStatus: "NOT_STARTED", currency: "SGD", amount: 9,
      pickupSlotStart: "2026-10-09T10:00:00Z", pickupSlotEnd: "2026-10-09T10:30:00Z",
      pickupExpiresAt: "2026-10-09T11:00:00Z", pickupTimezone: "Asia/Singapore",
    }]);
    render(<CustomerOrders />);
    await userEvent.click(await screen.findByRole("tab", { name: "customer.orders.past" }));
    expect(await screen.findByText("customer.orders.expired")).toBeInTheDocument();
    expect(screen.getByText("customer.orders.pickupSlot")).toBeInTheDocument();
    expect(screen.getByText("customer.orders.collectBy")).toBeInTheDocument();
    expect(screen.queryByText("pickup.status.NOT_STARTED")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "arrival.show" })).not.toBeInTheDocument();
  });

  it("shows view-specific empty states and refreshes orders that become completed", async () => {
    listAllCustomerTransactions.mockResolvedValueOnce([
      { transactionId: "ACTIVE-1", state: "PAYMENT_PENDING" },
    ]).mockResolvedValueOnce([
      { transactionId: "ACTIVE-1", state: "HANDED_OVER" },
    ]);
    const user = userEvent.setup();
    render(<CustomerOrders />);
    await screen.findByText("ACTIVE-1");
    await user.click(screen.getByRole("tab", { name: "customer.orders.past" }));
    expect(screen.getByText(/customer.orders.noPast/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "customer.orders.current" }));
    await user.click(screen.getByRole("button", { name: "pickup.refresh" }));
    expect(await screen.findByText(/customer.orders.noCurrent/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "customer.orders.past" }));
    expect(screen.getByText("ACTIVE-1")).toBeInTheDocument();
  });

  it("shows load failures without stale orders or a misleading empty state", async () => {
    listAllCustomerTransactions.mockResolvedValueOnce([
      { transactionId: "STALE-1", state: "PAYMENT_PENDING" },
    ]).mockRejectedValueOnce(new Error("Incomplete customer order history response"));
    render(<CustomerOrders />);
    await screen.findByText("STALE-1");
    await userEvent.click(screen.getByRole("button", { name: "pickup.refresh" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("customer.orders.loadFailed");
    expect(screen.queryByText("STALE-1")).not.toBeInTheDocument();
    expect(screen.queryByText(/customer.orders.noCurrent/)).not.toBeInTheDocument();
  });

  it("uses a compact reference and translated status while keeping full order details accessible", async () => {
    const transactionId = "txn_8473f397-8a82-467b-b748-083f2596f6b3";
    listAllCustomerTransactions.mockResolvedValue([{
      transactionId, channel: "MOBILE_ORDER", paymentMode: "PAY_AT_COUNTER",
      state: "CASH_PENDING_CONFIRMATION", preparationStatus: "NOT_STARTED",
      currency: "SGD", amount: 9, createdAt: "2026-10-10T07:50:00Z",
    }]);
    render(<CustomerOrders />);
    expect(await screen.findByText("#2596f6b3")).toBeInTheDocument();
    expect(screen.getByText("customer.orders.status.CASH_PENDING_CONFIRMATION")).toBeInTheDocument();
    expect(screen.queryByText("CASH_PENDING_CONFIRMATION")).not.toBeInTheDocument();
    expect(screen.getByText("SGD 9")).toBeInTheDocument();
    expect(screen.getByText("customer.orders.arrivalInstructions")).toBeInTheDocument();
    const summary = screen.getByText("customer.orders.details");
    const details = summary.closest("details");
    expect(details).not.toHaveAttribute("open");
    await userEvent.click(summary);
    expect(details).toHaveAttribute("open");
    expect(within(details).getByText(`customer.orders.orderReference: ${transactionId}`)).toBeVisible();
    expect(screen.getByRole("button", { name: "arrival.show" })).toBeInTheDocument();
  });

  it("lists purchased products and quantity/unit before the authoritative order amount in both views", async () => {
    const items = [
      { saleLineId: "LINE-1", skuId: "APPLE", productName: "Apples", quantity: 2, uom: "EA",
        productPicture: "https://images.example/apple.jpg" },
      { saleLineId: "LINE-2", skuId: "GRAPE", productName: "Grapes", quantity: "0.75", uom: "KG",
        productPicture: { id: "GRAPE-FILE", provider: "LOCAL" } },
    ];
    listAllCustomerTransactions.mockResolvedValue([
      { transactionId: "CURRENT-ITEMS", state: "PAYMENT_PENDING", currency: "SGD", amount: 9, items },
      { transactionId: "PAST-ITEMS", state: "HANDED_OVER", currency: "SGD", amount: 9, items },
    ]);
    render(<CustomerOrders />);
    const apples = await screen.findByText("Apples");
    const thumbnail = screen.getByRole("img", { name: "Apples" });
    expect(thumbnail).toHaveAttribute("src", "https://images.example/apple.jpg");
    expect(thumbnail.compareDocumentPosition(apples) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("img", { name: "Grapes" })).toHaveAttribute("src", "https://files.example/GRAPE-FILE");
    expect(screen.getByText("2 EA")).toBeInTheDocument();
    expect(screen.getByText("0.75 KG")).toBeInTheDocument();
    expect(apples.compareDocumentPosition(screen.getByText("SGD 9")) &
      Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("customer.orders.itemsUnavailable")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "customer.orders.past" }));
    expect(screen.getByText("Apples")).toBeVisible();
    expect(screen.getByText("Grapes")).toBeVisible();
    expect(screen.getByRole("img", { name: "Apples" })).toBeVisible();
  });

  it("keeps product details visible with a placeholder when its thumbnail is missing or fails", async () => {
    listAllCustomerTransactions.mockResolvedValue([{ transactionId: "NO-PICTURE", state: "PAYMENT_PENDING",
      currency: "SGD", amount: 9, items: [
        { saleLineId: "A", productName: "Apples", quantity: 2, uom: "EA" },
        { saleLineId: "B", productName: "Grapes", quantity: 1, uom: "KG", productPicture: "https://images.example/broken.jpg" },
      ] }]);
    render(<CustomerOrders />);
    expect(await screen.findByText("Apples")).toBeVisible();
    expect(screen.getAllByText("Product placeholder")).toHaveLength(2);
    const image = screen.getByRole("img", { name: "Grapes" });
    fireEvent.error(image);
    expect(image).not.toBeVisible();
    expect(screen.getByText("Grapes")).toBeVisible();
    expect(screen.getByText("1 KG")).toBeVisible();
  });

  it("uses the PDA checkout catalog lookup to find order thumbnails beyond the first page", async () => {
    listAllCustomerTransactions.mockResolvedValue([{ transactionId: "CATALOG-IMAGE", state: "PAYMENT_PENDING",
      currency: "SGD", amount: 9, items: [
        { saleLineId: "A", skuId: "ORANGE", productName: "Sunkist Orange 500g", quantity: 6, uom: "EA" },
        { saleLineId: "B", skuId: "ORANGE", productName: "Sunkist Orange 500g", quantity: 1, uom: "EA" },
      ] }]);
    listProducts.mockResolvedValueOnce({ data: { total: 2, items: [{ skuId: "OTHER" }] } })
      .mockResolvedValueOnce({ data: { total: 2, items: [
        { skuId: "ORANGE", productPicture: "https://images.example/orange.jpg" },
      ] } });
    render(<CustomerOrders />);
    const images = await screen.findAllByRole("img", { name: "Sunkist Orange 500g" });
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", "https://images.example/orange.jpg");
    expect(listProducts).toHaveBeenCalledTimes(2);
    expect(listProducts).toHaveBeenLastCalledWith({ active: true, page: 1, pageSize: 100 });
    expect(screen.getByText("6 EA")).toBeVisible();
    expect(screen.getByText("SGD 9")).toBeVisible();
  });

  it("reports catalog picture lookup failure without hiding original purchased lines", async () => {
    listAllCustomerTransactions.mockResolvedValue([{ transactionId: "IMAGE-ERROR", state: "PAYMENT_PENDING",
      currency: "SGD", amount: 9, items: [
        { saleLineId: "A", skuId: "ORANGE", productName: "Orange", quantity: 6, uom: "EA" },
      ] }]);
    listProducts.mockRejectedValue(new Error("Catalog unavailable"));
    render(<CustomerOrders />);
    expect(await screen.findByText("customer.cart.picturesFailed")).toBeVisible();
    expect(screen.getByText("Orange")).toBeVisible();
    expect(screen.getByText("6 EA")).toBeVisible();
    expect(screen.getByText("SGD 9")).toBeVisible();
  });

  it.each([
    undefined,
    [],
    [{ saleLineId: "LINE-1", productName: "Apples", quantity: -1, uom: "EA" }],
    [{ saleLineId: "LINE-1", productName: "", quantity: 1, uom: "EA" }],
    [null],
    Array(2).fill({ saleLineId: "LINE-1", productName: "Apples", quantity: 1, uom: "EA" }),
  ])("shows an explicit warning for missing or malformed purchased items: %j", async (items) => {
    listAllCustomerTransactions.mockResolvedValue([
      { transactionId: "INVALID-ITEMS", state: "PAYMENT_PENDING", currency: "SGD", amount: 9, items },
    ]);
    render(<CustomerOrders />);
    expect(await screen.findByText("customer.orders.itemsUnavailable")).toBeInTheDocument();
    expect(screen.getByText("SGD 9")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
