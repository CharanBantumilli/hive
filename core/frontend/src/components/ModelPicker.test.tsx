import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { ModelsOverview } from "@/api/models";

const endpointModels = vi.fn();
vi.mock("@/api/models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/models")>()),
  modelsApi: { endpointModels: (name: string) => endpointModels(name) },
}));

import ModelPicker from "./ModelPicker";

const overview: ModelsOverview = {
  slots: { llm: null, worker_llm: null, vision_fallback: null },
  judge: { configured: false, model: null, api_base: null },
  queens: [],
  providers: [
    {
      id: "anthropic",
      connected: true,
      models: [{ id: "claude-x", label: "Claude X", recommended: true, max_context_tokens: 200000, supports_vision: true }],
    },
    { id: "mistral", connected: false, models: [{ id: "mistral-x", label: "Mistral X", recommended: false, max_context_tokens: null, supports_vision: false }] },
  ],
  endpoints: [
    { name: "magpie", api_base: "http://127.0.0.1:3425/v1", builtin: true, has_key: false, running: true },
    { name: "ollama", api_base: "http://localhost:11434/v1", builtin: false, has_key: false, running: false },
  ],
  subscriptions: [],
};

function open() {
  fireEvent.click(screen.getByRole("button", { name: "Main model" }));
  return screen.getByRole("listbox");
}

describe("ModelPicker", () => {
  beforeEach(() => {
    endpointModels.mockReset();
    endpointModels.mockResolvedValue({ models: [{ id: "kimi/k3", max_context_tokens: 262144 }, { id: "group/opus-anywhere", max_context_tokens: null }] });
  });

  it("lists a running endpoint's models live and connected providers' from the catalog", async () => {
    render(<ModelPicker overview={overview} value={null} placeholder="Pick a model" onPick={vi.fn()} ariaLabel="Main model" />);

    const list = open();

    expect(await within(list).findByText("kimi/k3")).toBeTruthy();
    expect(within(list).getByText("262k")).toBeTruthy();
    expect(within(list).getByText("Claude X")).toBeTruthy();
    expect(within(list).queryByText("Mistral X")).toBeNull(); // no key for Mistral
    expect(endpointModels).toHaveBeenCalledTimes(1); // ollama isn't running
  });

  it("narrows the list as you type", async () => {
    render(<ModelPicker overview={overview} value={null} placeholder="Pick a model" onPick={vi.fn()} ariaLabel="Main model" />);
    const list = open();
    await within(list).findByText("kimi/k3");

    fireEvent.change(within(list).getByPlaceholderText("Search models"), { target: { value: "opus" } });

    expect(within(list).getByText("group/opus-anywhere")).toBeTruthy();
    expect(within(list).queryByText("kimi/k3")).toBeNull();
    expect(within(list).queryByText("Claude X")).toBeNull();
  });

  it("applies a pick, and shows why when it fails", async () => {
    const onPick = vi.fn().mockRejectedValueOnce(new Error("magpie refused the key (HTTP 401)"));
    render(<ModelPicker overview={overview} value={null} placeholder="Pick a model" onPick={onPick} ariaLabel="Main model" />);

    fireEvent.click(await within(open()).findByText("kimi/k3"));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("magpie refused the key (HTTP 401)"));
    expect(onPick).toHaveBeenCalledWith({ source: "endpoint", endpoint: "magpie", model: "kimi/k3" });
  });

  it("says why an endpoint's models can't be listed", async () => {
    endpointModels.mockRejectedValue(new Error("Can't reach http://127.0.0.1:3425/v1/models"));
    render(<ModelPicker overview={overview} value={null} placeholder="Pick a model" onPick={vi.fn()} ariaLabel="Main model" />);

    expect(await within(open()).findByText("Can't reach http://127.0.0.1:3425/v1/models")).toBeTruthy();
  });

  it("offers the slot's default first, and shows what it uses now", async () => {
    const onClear = vi.fn().mockResolvedValue(undefined);
    const value = {
      source: "endpoint" as const,
      provider: "openai",
      model: "kimi/k3",
      endpoint: "magpie",
      subscription: null,
      api_base: "http://127.0.0.1:3425/v1",
      max_context_tokens: 262144,
      has_extra_body: false,
    };
    render(<ModelPicker overview={overview} value={value} placeholder="Same as the main model" onPick={vi.fn()} onClear={onClear} ariaLabel="Main model" />);

    expect(screen.getByText("Magpie · 262k context")).toBeTruthy();
    fireEvent.click(within(open()).getByText("Same as the main model"));

    await waitFor(() => expect(onClear).toHaveBeenCalled());
  });
});
