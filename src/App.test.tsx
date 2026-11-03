import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { WalletProvider } from "./wallet";

const ACCOUNT = `0x${"a1".repeat(20)}`;
const OTHER = `0x${"c3".repeat(20)}`;
const CONTRACT = `0x${"b2".repeat(20)}`;
const TRUE = `0x${"0".repeat(63)}1`;

type Handler = (...args: unknown[]) => unknown;

function wallet(overrides: Record<string, () => unknown> = {}) {
  const listeners = new Map<string, Handler>();
  const replies: Record<string, () => unknown> = {
    eth_accounts: () => [],
    eth_chainId: () => "0x33",
    eth_requestAccounts: () => [ACCOUNT],
    eth_call: () => TRUE,
    wallet_switchEthereumChain: () => null,
    ...overrides,
  };
  const provider = {
    request: vi.fn(async ({ method }: { method: string }) => replies[method]()),
    on: vi.fn((event: string, listener: Handler) => listeners.set(event, listener)),
    removeListener: vi.fn((event: string) => listeners.delete(event)),
  };
  window.ethereum = provider as unknown as WalletProvider;
  return { provider, listeners };
}

async function connected(overrides: Record<string, () => unknown> = {}) {
  const result = wallet({ eth_accounts: () => [ACCOUNT], ...overrides });
  const view = render(<App />);
  await screen.findByText(ACCOUNT);
  return { ...result, ...view };
}

function enterContract(value: string) {
  fireEvent.change(screen.getByLabelText("Login token contract"), { target: { value } });
}

afterEach(() => {
  cleanup();
  delete window.ethereum;
});

describe("App", () => {
  it("offers an install link when there is no wallet", () => {
    render(<App />);
    expect(screen.getByRole("status").textContent).toContain("No wallet found");
    expect(screen.getByRole("link", { name: "Install XDCPay" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("asks for an account only when the user chooses to connect", async () => {
    const { provider } = wallet();
    render(<App />);
    await act(async () => {});
    expect(provider.request).not.toHaveBeenCalledWith({ method: "eth_requestAccounts" });

    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    expect(await screen.findByText(ACCOUNT)).toBeTruthy();
    expect(screen.getByText("Apothem testnet")).toBeTruthy();
  });

  it("explains a declined connection", async () => {
    wallet({
      eth_requestAccounts: () => {
        throw { code: 4001, message: "no" };
      },
    });
    render(<App />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    expect((await screen.findByRole("alert")).textContent).toContain("declined");
  });

  it("offers a switch on another network", async () => {
    const { provider } = await connected({ eth_chainId: () => "0x1" });
    expect(screen.getByText("Unknown network (1)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Switch to Apothem testnet" }));
    await act(async () => {});
    expect(provider.request).toHaveBeenCalledWith({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x33" }] });
  });

  it("does not check on a network it does not know", async () => {
    await connected({ eth_chainId: () => "0x7a69" });
    enterContract(CONTRACT);
    const check = screen.getByRole("button", { name: "Check login" }) as HTMLButtonElement;
    expect(check.disabled).toBe(true);
  });

  describe("a reply that arrives after something changed", () => {
    function pendingCall() {
      let finish: (value: string) => void = () => {};
      let fail: (reason: unknown) => void = () => {};
      const reply = new Promise<string>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      });
      return { reply, finish: (value: string) => finish(value), fail: (reason: unknown) => fail(reason) };
    }

    async function startCheck() {
      const call = pendingCall();
      const { listeners } = await connected({ eth_call: () => call.reply });
      enterContract(CONTRACT);
      fireEvent.click(screen.getByRole("button", { name: "Check login" }));
      await act(async () => {});
      return { call, listeners };
    }

    it("is ignored after the account changes", async () => {
      const { call, listeners } = await startCheck();
      await act(async () => {
        listeners.get("accountsChanged")?.([OTHER]);
      });
      await act(async () => {
        call.finish(TRUE);
      });
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("is ignored after the network changes", async () => {
      const { call, listeners } = await startCheck();
      await act(async () => {
        listeners.get("chainChanged")?.("0x32");
      });
      await act(async () => {
        call.finish(TRUE);
      });
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("is ignored after the contract changes", async () => {
      const { call } = await startCheck();
      enterContract(OTHER);
      await act(async () => {
        call.finish(TRUE);
      });
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("is ignored after the account is forgotten", async () => {
      const { call } = await startCheck();
      fireEvent.click(screen.getByRole("button", { name: "Forget this account" }));
      await act(async () => {
        call.finish(TRUE);
      });
      fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
      await screen.findByText(ACCOUNT);
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("hides a stale failure too", async () => {
      const { call, listeners } = await startCheck();
      await act(async () => {
        listeners.get("accountsChanged")?.([OTHER]);
      });
      await act(async () => {
        call.fail(new Error("the node is down"));
      });
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("an error from an earlier check", () => {
    async function failedCheck() {
      const { listeners } = await connected({ eth_call: () => "0x" });
      enterContract(CONTRACT);
      fireEvent.click(screen.getByRole("button", { name: "Check login" }));
      await screen.findByRole("alert");
      return listeners;
    }

    it("clears when the account changes", async () => {
      const listeners = await failedCheck();
      await act(async () => {
        listeners.get("accountsChanged")?.([OTHER]);
      });
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("clears when the network changes", async () => {
      const listeners = await failedCheck();
      await act(async () => {
        listeners.get("chainChanged")?.("0x32");
      });
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("clears when the contract changes", async () => {
      await failedCheck();
      enterContract(OTHER);
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("the first read of the wallet", () => {
    it("does not overwrite an account change", async () => {
      let finish: (accounts: string[]) => void = () => {};
      const reply = new Promise<string[]>((resolve) => {
        finish = resolve;
      });
      const { listeners } = wallet({ eth_accounts: () => reply });
      render(<App />);
      await act(async () => {
        listeners.get("accountsChanged")?.([OTHER]);
      });
      await act(async () => {
        finish([ACCOUNT]);
      });
      expect(screen.getByText(OTHER)).toBeTruthy();
      expect(screen.queryByText(ACCOUNT)).toBeNull();
    });

    it("does not bring back an account the wallet disconnected", async () => {
      let finish: (accounts: string[]) => void = () => {};
      const reply = new Promise<string[]>((resolve) => {
        finish = resolve;
      });
      const { listeners } = wallet({ eth_accounts: () => reply });
      render(<App />);
      await act(async () => {
        listeners.get("accountsChanged")?.([]);
      });
      await act(async () => {
        finish([ACCOUNT]);
      });
      expect(screen.queryByText(ACCOUNT)).toBeNull();
      expect(screen.getByRole("button", { name: "Connect wallet" })).toBeTruthy();
    });

    it("does not undo a connection made while it was pending", async () => {
      let finish: (accounts: string[]) => void = () => {};
      const reply = new Promise<string[]>((resolve) => {
        finish = resolve;
      });
      wallet({ eth_accounts: () => reply });
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
      await screen.findByText(ACCOUNT);
      await act(async () => {
        finish([]);
      });
      expect(screen.getByText(ACCOUNT)).toBeTruthy();
    });

    it("does not overwrite a network change", async () => {
      let finish: (chain: string) => void = () => {};
      const reply = new Promise<string>((resolve) => {
        finish = resolve;
      });
      const { listeners } = wallet({ eth_accounts: () => [ACCOUNT], eth_chainId: () => reply });
      render(<App />);
      await act(async () => {
        listeners.get("chainChanged")?.("0x7a69");
      });
      await act(async () => {
        finish("0x33");
      });
      expect(screen.getByText("Unknown network (31337)")).toBeTruthy();
    });
  });

  it("needs a valid contract address before checking", async () => {
    await connected();
    const button = screen.getByRole("button", { name: "Check login" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    enterContract("nope");
    expect(button.disabled).toBe(true);
    enterContract(CONTRACT);
    expect(button.disabled).toBe(false);
  });

  it("shows when the account holds the token", async () => {
    await connected();
    enterContract(CONTRACT);
    fireEvent.click(screen.getByRole("button", { name: "Check login" }));
    expect((await screen.findByRole("status")).textContent).toBe("This account holds the login token.");
  });

  it("shows when the account does not hold the token", async () => {
    await connected({
      eth_call: () => {
        throw { code: -32000, message: "execution reverted: require Login token to login" };
      },
    });
    enterContract(CONTRACT);
    fireEvent.click(screen.getByRole("button", { name: "Check login" }));
    expect((await screen.findByRole("status")).textContent).toBe("This account does not hold the login token.");
  });

  it("shows an error, not a result, for an address with no contract", async () => {
    await connected({ eth_call: () => "0x" });
    enterContract(CONTRACT);
    fireEvent.click(screen.getByRole("button", { name: "Check login" }));
    expect((await screen.findByRole("alert")).textContent).toContain("did not answer");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("clears the result when the wallet changes account", async () => {
    const { listeners } = await connected();
    enterContract(CONTRACT);
    fireEvent.click(screen.getByRole("button", { name: "Check login" }));
    await screen.findByRole("status");

    act(() => void listeners.get("accountsChanged")?.([OTHER]));
    expect(screen.getByText(OTHER)).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("clears the result when the wallet changes network", async () => {
    const { listeners } = await connected();
    enterContract(CONTRACT);
    fireEvent.click(screen.getByRole("button", { name: "Check login" }));
    await screen.findByRole("status");

    act(() => void listeners.get("chainChanged")?.("0x32"));
    expect(screen.getByText("XDC mainnet")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("returns to the start when the wallet disconnects", async () => {
    const { listeners } = await connected();
    act(() => void listeners.get("accountsChanged")?.([]));
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeTruthy();
  });

  it("removes its wallet listeners when it closes", async () => {
    const { provider, unmount } = await connected();
    unmount();
    expect(provider.removeListener).toHaveBeenCalledTimes(2);
  });

  it("can forget the account", async () => {
    await connected();
    fireEvent.click(screen.getByRole("button", { name: "Forget this account" }));
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeTruthy();
    expect(screen.queryByText(ACCOUNT)).toBeNull();
  });
});
