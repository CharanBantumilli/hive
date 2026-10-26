import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ModelsOverview } from "@/api/models";

const overview = vi.fn();
const setSlot = vi.fn();
const saveEndpoint = vi.fn();
vi.mock("@/api/models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/models")>()),
  modelsApi: {
    overview: () => overview(),
    setSlot: (slot: string, choice: unknown) => setSlot(slot, choice),
    clearSlot: async () => ({}),
    endpointModels: async () => ({ models: [{ id: "kimi/k3", max_context_tokens: 262144 }] }),
    saveEndpoint: (name: string, body: unknown) => saveEndpoint(name, body),
    deleteEndpoint: async () => ({}),
  },
}));
const refresh = vi.fn();
const activateSubscription = vi.fn();
vi.mock("@/context/ModelContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/context/ModelContext")>()),
  useModelOptional: () => ({ refresh, activateSubscription, saveProviderKey: vi.fn(), removeProviderKey: vi.fn() }),
}));
vi.mock("@/components/ProviderManager", () => ({ default: () => <div>Slot editor</div> }));

import ModelsPage from "./models";

const OVERVIEW: ModelsOverview = {
  slots: {
    llm: {
      source: "catalog",
      provider: "anthropic",
      model: "claude-x",
      endpoint: null,
      subscription: null,
      api_base: null,
      max_context_tokens: 200000,
      has_extra_body: false,
    },
    worker_llm: null,
    vision_fallback: null,
  },
  judge: { configured: false, model: null, api_base: null },
  queens: [
    {
      id: "queen_ava",
      name: "Ava",
      source: "endpoint",
      provider: "openai",
      model: "kimi/k3",
      endpoint: "magpie",
      subscription: null,
      api_base: "http://127.0.0.1:3425/v1",
      max_context_tokens: null,
      has_extra_body: false,
    },
  ],
  providers: [
    { id: "anthropic", connected: true, models: [{ id: "claude-x", label: "Claude X", recommended: true, max_context_tokens: 200000, supports_vision: true }] },
  ],
  endpoints: [{ name: "magpie", api_base: "http://127.0.0.1:3425/v1", builtin: true, has_key: false, running: true }],
  subscriptions: [
    { id: "claude_code", name: "Claude Code Subscription", description: "Use your plan", model: "claude-x", detected: true, active: false, own_risk: true },
    { id: "codex", name: "Codex Subscription", description: "Use your plan", model: "gpt-x", detected: false, active: false, own_risk: true },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ModelsPage />
    </MemoryRouter>,
  );
}

describe("ModelsPage", () => {
  beforeEach(() => {
    for (const f of [overview, setSlot, saveEndpoint, refresh, activateSubscription]) f.mockReset();
    overview.mockResolvedValue(OVERVIEW);
    setSlot.mockResolvedValue({ slot: "llm", summary: null, sessions_switched: 2 });
    saveEndpoint.mockResolvedValue({ name: "ollama", api_base: "http://localhost:11434/v1", builtin: false, has_key: false, running: false });
  });

  it("shows each slot, the queens with their own model, Magpie and the providers", async () => {
    renderPage();

    expect(await screen.findByText("claude-x")).toBeTruthy();
    expect(screen.getAllByText("Same as the main model").length).toBeGreaterThan(0);
    expect(screen.getByText("None")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ava/ }).getAttribute("href")).toBe("/queen/queen_ava/profile");
    expect(screen.getByText("Magpie")).toBeTruthy();
    expect(screen.getByText("Running")).toBeTruthy();
  });

  it("offers only detected subscriptions, under a note that they are at your own risk", async () => {
    renderPage();

    const note = await screen.findByRole("note");
    expect(note.textContent).toMatch(/at your own risk/);
    expect(screen.queryByText("Codex Subscription")).toBeNull();
    fireEvent.click(screen.getByText("Use as the main model"));
    await waitFor(() => expect(activateSubscription).toHaveBeenCalledWith("claude_code"));
  });

  it("switches the main model from the picker and tells the rest of the dashboard", async () => {
    renderPage();
    await screen.findByText("claude-x");

    fireEvent.click(screen.getByRole("button", { name: "Main model" }));
    fireEvent.click(await within(screen.getByRole("listbox")).findByText("kimi/k3"));

    await waitFor(() => expect(setSlot).toHaveBeenCalledWith("llm", { source: "endpoint", endpoint: "magpie", model: "kimi/k3" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(overview).toHaveBeenCalledTimes(2);
  });

  it("adds an OpenAI-compatible endpoint", async () => {
    renderPage();
    fireEvent.click(await screen.findByText(/Add an OpenAI-compatible endpoint/));

    fireEvent.change(screen.getByPlaceholderText("ollama"), { target: { value: "ollama" } });
    fireEvent.change(screen.getByPlaceholderText("http://localhost:11434/v1"), { target: { value: "http://localhost:11434/v1" } });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => expect(saveEndpoint).toHaveBeenCalledWith("ollama", { api_base: "http://localhost:11434/v1" }));
  });
});
