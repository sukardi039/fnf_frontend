import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import PdaAccessHome from "./PdaAccessHome";
import { resolvePdaScan, confirmHandover } from "../../helpers/pda_helper";

vi.mock("../../helpers/pda_helper", () => ({ resolvePdaScan: vi.fn(), confirmHandover: vi.fn() }));
vi.mock("@mui/icons-material", () => ({ CheckCircleOutline: () => null, QrCodeScanner: () => null }));
vi.mock("react-i18next", () => {
  const t = (key) => key;
  return { useTranslation: () => ({ t }) };
});

describe("legacy PDA pickup verification", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.setItem("pda_user_info", JSON.stringify({ staffId: "STAFF-1", deviceId: "DEVICE-1" }));
  });
  afterEach(() => { cleanup(); localStorage.removeItem("pda_user_info"); });

  it.each([undefined, "PREPARING", "READY"])("requires packed readiness, not payment eligibility alone (%s)", async (preparationStatus) => {
    resolvePdaScan.mockResolvedValue({
      data: {
        transactionId: "TX-1", state: "READY_FOR_HANDOVER", paymentStatus: "SUCCESS",
        preparationStatus, handoverEligible: true,
        summary: { itemCount: 2, total: 10, currency: "MYR" },
      },
    });
    const user = userEvent.setup();
    render(<MemoryRouter><PdaAccessHome /></MemoryRouter>);
    await user.type(screen.getByLabelText("pda.handover.collectionToken"), "TOKEN");
    await user.click(screen.getByRole("button", { name: "pda.handover.verify" }));
    expect(await screen.findByRole("link", { name: "pickup.title" }))
      .toHaveAttribute("href", "/pda/pickup?transactionId=TX-1");
    if (preparationStatus === "READY") {
      expect(screen.getByRole("button", { name: "pda.handover.confirm" })).toBeInTheDocument();
    } else {
      expect(screen.queryByRole("button", { name: "pda.handover.confirm" })).not.toBeInTheDocument();
    }
    expect(confirmHandover).not.toHaveBeenCalled();
  });
});
