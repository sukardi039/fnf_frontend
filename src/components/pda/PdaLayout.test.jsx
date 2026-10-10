import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PdaLayout from "./PdaLayout";

vi.mock("@mui/icons-material", () => ({
  Person: () => null, ShoppingCart: () => null, LocalShipping: () => null,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));

describe("consolidated PDA navigation", () => {
  afterEach(cleanup);
  it("offers one pickup workflow and preserves counter checkout and profile", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/pda/pickup"]}><Routes>
      <Route path="/pda" element={<PdaLayout />}>
        <Route path="pickup" element={<div>Shared pickup</div>} />
        <Route path="checkout" element={<div>Counter checkout</div>} />
        <Route path="me" element={<div>Staff profile</div>} />
      </Route>
    </Routes></MemoryRouter>);
    expect(screen.getByText("Shared pickup")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "pda.nav.verifyCollection" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "pda.nav.assistedCheckout" }));
    expect(screen.getByText("Counter checkout")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "pda.nav.logout" }));
    expect(screen.getByText("Staff profile")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "pickup.nav" }));
    expect(screen.getByText("Shared pickup")).toBeInTheDocument();
  });
});
