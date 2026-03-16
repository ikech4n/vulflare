import { render, screen } from "@/test/utils";
import { describe, expect, it } from "vite-plus/test";
import { SeverityBadge } from "./SeverityBadge";

describe("SeverityBadge", () => {
  it("renders critical severity correctly", () => {
    render(<SeverityBadge severity="critical" />);
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("renders high severity correctly", () => {
    render(<SeverityBadge severity="high" />);
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("renders medium severity correctly", () => {
    render(<SeverityBadge severity="medium" />);
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  it("renders low severity correctly", () => {
    render(<SeverityBadge severity="low" />);
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("renders informational severity correctly", () => {
    render(<SeverityBadge severity="informational" />);
    expect(screen.getByText("Info")).toBeInTheDocument();
  });

  it("applies correct color classes for critical", () => {
    const { container } = render(<SeverityBadge severity="critical" />);
    const badge = container.querySelector("span");
    expect(badge).toHaveClass("bg-red-100");
    expect(badge).toHaveClass("text-red-800");
  });

  it("applies correct color classes for high", () => {
    const { container } = render(<SeverityBadge severity="high" />);
    const badge = container.querySelector("span");
    expect(badge).toHaveClass("bg-orange-100");
    expect(badge).toHaveClass("text-orange-800");
  });
});
