import React, { useContext } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AuthContext, AuthProvider } from "./authContext";
import { expireSession } from "../helpers/session_helper";

vi.mock("../helpers/axios_helper", () => ({
  getAuthToken: () => null, setAuthHeader: vi.fn(), request: vi.fn(),
}));
function Probe() {
  const location = useLocation();
  const auth = useContext(AuthContext);
  return <div>{location.pathname} {auth.isAuthenticated ? "signed-in" : "signed-out"}</div>;
}
describe("expiry navigation", () => {
  afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });
  it.each([
    ["WEB", "/home", "/login"], ["PDA", "/pda/pickup", "/pda/login"],
    ["MOBILE", "/m/orders", "/m/auth"],
  ])("%s returns to login without requiring dialog acknowledgement", async (surface, path, target) => {
    window.history.replaceState({}, "", path);
    render(<MemoryRouter initialEntries={[path]}><AuthProvider><Probe /></AuthProvider></MemoryRouter>);
    await screen.findByText(`${path} signed-out`);
    act(() => expireSession(surface));
    expect(screen.getByText(`${target} signed-out`)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
