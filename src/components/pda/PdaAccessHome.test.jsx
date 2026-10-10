import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import PdaAccessHome from "./PdaAccessHome";

function Destination() {
  const location = useLocation();
  return <div>{location.pathname}{location.search}</div>;
}

describe("PDA shared pickup entry", () => {
  afterEach(cleanup);
  it.each(["/pda/home", "/pda/home?transactionId=TX-1"])(
    "redirects old collection entry to the shared workflow (%s)", async (entry) => {
      render(<MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/pda/home" element={<PdaAccessHome />} />
          <Route path="/pda/pickup" element={<Destination />} />
        </Routes>
      </MemoryRouter>);
      expect(await screen.findByText(entry.replace("/home", "/pickup"))).toBeInTheDocument();
    },
  );
});
