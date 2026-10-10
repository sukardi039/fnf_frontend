import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PdaMe from "./PdaMe";
import { request } from "../../helpers/axios_helper";

vi.mock("../../helpers/axios_helper", () => ({ request: vi.fn() }));
vi.mock("@mui/icons-material", () => ({ Person: () => null, Logout: () => null }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({
  t: (key, fallback) => typeof fallback === "string" ? fallback : key,
}) }));

describe("PDA logout navigation", () => {
  afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); });
  it.each([false, true])("returns directly to login and clears only PDA credentials (server failure: %s)", async (fails) => {
    localStorage.setItem("pda_user_info", JSON.stringify({ staffName: "Staff" }));
    sessionStorage.setItem("pda_auth_token", "pda-token");
    sessionStorage.setItem("auth_token", "web-token");
    if (fails) {
      request.mockRejectedValue(new Error("Logout unavailable"));
      vi.spyOn(console, "error").mockImplementation(() => {});
    } else request.mockResolvedValue({ data: {} });
    render(<MemoryRouter initialEntries={["/pda/me"]}><Routes>
      <Route path="/pda/me" element={<PdaMe />} />
      <Route path="/login" element={<div>Login screen</div>} />
    </Routes></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: /Logout/i }));
    expect(await screen.findByText("Login screen")).toBeInTheDocument();
    expect(localStorage.getItem("pda_user_info")).toBeNull();
    expect(sessionStorage.getItem("pda_auth_token")).toBeNull();
    expect(sessionStorage.getItem("auth_token")).toBe("web-token");
  });
});
