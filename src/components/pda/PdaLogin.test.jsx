import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import PdaLogin from "./PdaLogin";
import { request, setAuthHeader } from "../../helpers/axios_helper";

vi.mock("../../helpers/axios_helper", () => ({ request: vi.fn(), setAuthHeader: vi.fn() }));
vi.mock("react-i18next", () => {
  const t = (key) => key;
  return { useTranslation: () => ({ t }) };
});
describe("PDA expired session landing", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it("exchanges a one-use QR only once under StrictMode and enters the PDA session", async () => {
    let finish;
    request.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<React.StrictMode><MemoryRouter initialEntries={["/pda/login?loginkey=test-challenge"]}>
      <Routes>
        <Route path="/pda/login" element={<PdaLogin />} />
        <Route path="/pda/home" element={<div>PDA home</div>} />
      </Routes>
    </MemoryRouter></React.StrictMode>);
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    expect(request).toHaveBeenCalledWith("POST", "/api/mobile-logins/login",
      { loginKey: "test-challenge" },
      { skipAuthRedirect: true, skipBackendErrorDialog: true, sessionInterface: "PDA" });
    await act(async () => finish({ data: { token: "test-token", staffId: "STAFF-1" } }));
    expect(await screen.findByText("PDA home")).toBeInTheDocument();
    expect(setAuthHeader).toHaveBeenCalledOnce();
    expect(setAuthHeader).toHaveBeenCalledWith("test-token", "PDA");
    localStorage.removeItem("pda_user_info");
  });

  it("ignores a login result after leaving the QR page", async () => {
    let finish;
    request.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const view = render(<MemoryRouter initialEntries={["/pda/login?loginkey=another-test"]}>
      <PdaLogin />
    </MemoryRouter>);
    view.unmount();
    await act(async () => finish({ data: { token: "late-token" } }));
    expect(setAuthHeader).not.toHaveBeenCalled();
  });
  it("shows fresh-sign-in instructions instead of a spinner or reusing an old QR key", async () => {
    render(<MemoryRouter initialEntries={["/pda/login"]}><Routes>
      <Route path="/pda/login" element={<PdaLogin />} />
      <Route path="/login" element={<div>Login screen</div>} />
    </Routes></MemoryRouter>);
    expect(screen.getByText("pda.login.signInAgain")).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "pda.login.openLogin" }));
    expect(screen.getByText("Login screen")).toBeInTheDocument();
  });
});
