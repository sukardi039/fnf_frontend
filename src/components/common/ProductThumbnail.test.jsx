import React from "react";
import PropTypes from "prop-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ProductThumbnail from "./ProductThumbnail";

vi.mock("@mui/icons-material", () => ({ Inventory2: () => <span>Product placeholder</span> }));
vi.mock("../../helpers/file_helper", async (importOriginal) => ({
  ...await importOriginal(),
  ThumbnailImg: FileThumbnail,
}));

function FileThumbnail({ fileId, alt, onError }) {
  return <img src={`https://files.example/${fileId}`} alt={alt} onError={onError} />;
}
FileThumbnail.propTypes = { fileId: PropTypes.string, alt: PropTypes.string, onError: PropTypes.func };

describe("authoritative product thumbnail", () => {
  afterEach(cleanup);

  it.each([
    ["https://images.example/orange.jpg", "https://images.example/orange.jpg"],
    [{ id: "FILE-1", provider: "LOCAL" }, "https://files.example/FILE-1"],
    [JSON.stringify([{ id: "FILE-1", provider: "LOCAL" }]), "https://files.example/FILE-1"],
    [[{ id: "FILE-1", provider: "LOCAL" }], "https://files.example/FILE-1"],
    ["data:image/png;base64,YWJj", "data:image/png;base64,YWJj"],
    ["a".repeat(104), `data:image/png;base64,${"a".repeat(104)}`],
  ])("handles the existing picture representation %j", (picture, expectedSrc) => {
    render(<ProductThumbnail picture={picture} alt="Orange" />);
    expect(screen.getByRole("img", { name: "Orange" })).toHaveAttribute("src", expectedSrc);
  });

  it.each([
    "https://images.example/broken.jpg",
    { id: "BROKEN-FILE", provider: "LOCAL" },
  ])("preserves a placeholder on image failure and retries a changed source: %j", (picture) => {
    const { rerender } = render(<ProductThumbnail picture={picture} alt="Orange" />);
    fireEvent.error(screen.getByRole("img", { name: "Orange" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Product placeholder")).toBeInTheDocument();
    rerender(<ProductThumbnail picture="https://images.example/new.jpg" alt="Orange" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://images.example/new.jpg");
  });

  it("reserves thumbnail space for missing pictures and supports maintenance sizing", () => {
    const { container, rerender } = render(<ProductThumbnail alt="Orange" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.firstChild).toHaveStyle({ width: "64px", height: "64px" });
    rerender(<ProductThumbnail picture="https://images.example/orange.jpg" alt="Orange" width={40} height={40} fit="cover" />);
    expect(container.firstChild).toHaveStyle({ width: "40px", height: "40px" });
    expect(screen.getByRole("img")).toHaveStyle({ objectFit: "cover" });
  });
});
