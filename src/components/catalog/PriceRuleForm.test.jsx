import React from "react";
import PropTypes from "prop-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PriceRuleForm from "./PriceRuleForm";
import {
  createPriceRule,
  fetchActiveProducts,
  updatePriceRule,
} from "./productApi";

vi.mock("./productApi", () => ({
  createPriceRule: vi.fn(),
  fetchActiveProducts: vi.fn(),
  updatePriceRule: vi.fn(),
}));
vi.mock("../common", () => ({
  HeaderBar: HeaderBarMock,
  LoadingState: LoadingStateMock,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));

function HeaderBarMock({ title }) {
  return <h1>{title}</h1>;
}
HeaderBarMock.propTypes = { title: PropTypes.node };

function LoadingStateMock({ message }) {
  return <p>{message}</p>;
}
LoadingStateMock.propTypes = { message: PropTypes.node };

const expiredRule = {
  ruleId: "RULE-EXPIRED",
  ruleName: "Expired apple promotion",
  slogan: "Old offer",
  skuId: "SKU-APPLE",
  discountType: "PERCENT",
  discountValue: 10,
  baseUnit: "CENT",
  roundingMode: "HALF_UP",
  startAt: "2020-01-01T00:00:00Z",
  endAt: "2020-01-31T23:59:59Z",
  priority: 2,
  status: "EXPIRED",
};

describe("PriceRuleForm edit route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchActiveProducts.mockResolvedValue({
      data: { items: [{ skuId: "SKU-APPLE", productName: "Apples", productCode: "APL" }] },
    });
    createPriceRule.mockResolvedValue({
      data: { ruleId: "RULE-NEW", status: "DRAFT" },
    });
    updatePriceRule.mockResolvedValue({
      data: { ruleId: "RULE-EXPIRED", status: "DRAFT" },
    });
  });

  afterEach(cleanup);

  it("loads and updates an expired rule passed through route state", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/price-rules/edit", state: { priceRule: expiredRule } },
        ]}
      >
        <Routes>
          <Route path="/price-rules/edit" element={<PriceRuleForm />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "priceRule.editTitle" }))
      .toBeInTheDocument();
    expect(screen.getByDisplayValue("Expired apple promotion"))
      .toHaveValue("Expired apple promotion");
    expect(screen.getByDisplayValue("Old offer")).toHaveValue("Old offer");
    expect(screen.getByDisplayValue("10")).toHaveValue(10);
    expect(updatePriceRule).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "basic.save" }));
    await waitFor(() => {
      expect(updatePriceRule).toHaveBeenCalledWith(
        "RULE-EXPIRED",
        expect.objectContaining({
          ruleName: "Expired apple promotion",
          skuId: "SKU-APPLE",
          discountValue: 10,
          status: "DRAFT",
        }),
      );
    });
    expect(createPriceRule).not.toHaveBeenCalled();
  });

  it("reports when the update response does not confirm a draft expired rule", async () => {
    updatePriceRule.mockResolvedValueOnce({
      data: { ruleId: "RULE-EXPIRED", status: "ACTIVE" },
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/price-rules/edit", state: { priceRule: expiredRule } },
        ]}
      >
        <Routes>
          <Route path="/price-rules/edit" element={<PriceRuleForm />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: "basic.save" }),
    );

    expect(
      await screen.findByText("priceRule.expiredUpdateNotDraft"),
    ).toBeInTheDocument();
  });

  it("keeps active price rules read-only", async () => {
    const activeRule = {
      ...expiredRule,
      status: "ACTIVE",
      endAt: new Date(Date.now() + 60_000).toISOString(),
    };
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/price-rules/edit", state: { priceRule: activeRule } },
        ]}
      >
        <Routes>
          <Route path="/price-rules/edit" element={<PriceRuleForm />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("priceRule.activeCannotEdit"))
      .toBeInTheDocument();
    expect(screen.getByDisplayValue("Expired apple promotion")).toBeDisabled();
    expect(screen.getByRole("button", { name: "basic.save" })).toBeDisabled();
  });

  it("updates an ACTIVE rule whose end time passed with DRAFT status", async () => {
    const expiredActiveRule = { ...expiredRule, status: "ACTIVE" };
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/price-rules/edit",
            state: { priceRule: expiredActiveRule },
          },
        ]}
      >
        <Routes>
          <Route path="/price-rules/edit" element={<PriceRuleForm />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue("Expired apple promotion"))
      .toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "basic.save" }));
    await waitFor(() => {
      expect(updatePriceRule).toHaveBeenCalledWith(
        "RULE-EXPIRED",
        expect.objectContaining({
          ruleName: "Expired apple promotion",
          status: "DRAFT",
        }),
      );
    });
  });

  it("creates new price rules as drafts", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter
        initialEntries={["/price-rules/new"]}
      >
        <Routes>
          <Route path="/price-rules/new" element={<PriceRuleForm />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "priceRule.title" });
    await user.type(
      container.querySelector('input[name="ruleName"]'),
      "Fresh offer",
    );
    await user.type(
      container.querySelector('input[name="discountValue"]'),
      "10",
    );
    await user.click(container.querySelector('[role="combobox"]'));
    await user.click(await screen.findByRole("option", { name: "Apples (APL)" }));
    fireEvent.change(container.querySelector('input[name="startAt"]'), {
      target: { value: "2026-10-06T10:00" },
    });
    fireEvent.change(container.querySelector('input[name="endAt"]'), {
      target: { value: "2026-10-07T10:00" },
    });
    await user.click(screen.getByRole("button", { name: "basic.save" }));
    await waitFor(() => {
      expect(createPriceRule).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleName: "Fresh offer",
          status: "DRAFT",
        }),
      );
    });
  });
});
