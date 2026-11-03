import { describe, expect, it, vi } from "vitest";
import {
  APOTHEM,
  CHECK_LOGIN_SELECTOR,
  WalletError,
  checkLogin,
  connect,
  currentAccount,
  currentChainId,
  isAddress,
  networkName,
  switchNetwork,
  toHexAddress,
  type WalletProvider,
} from "./wallet";

const ACCOUNT = `0x${"a1".repeat(20)}`;
const CONTRACT = `0x${"b2".repeat(20)}`;
const TRUE = `0x${"0".repeat(63)}1`;

function providerWith(...replies: unknown[]) {
  const request = vi.fn();
  for (const reply of replies) {
    if (reply instanceof Error || (reply as { code?: unknown })?.code !== undefined) {
      request.mockRejectedValueOnce(reply);
    } else {
      request.mockResolvedValueOnce(reply);
    }
  }
  return { request } as unknown as WalletProvider & { request: ReturnType<typeof vi.fn> };
}

describe("addresses", () => {
  it("accepts both prefixes and refuses anything else", () => {
    expect(isAddress(ACCOUNT)).toBe(true);
    expect(isAddress(`xdc${"a1".repeat(20)}`)).toBe(true);
    expect(isAddress("0x123")).toBe(false);
    expect(isAddress(`0x${"zz".repeat(20)}`)).toBe(false);
  });

  it("converts xdc addresses for RPC calls", () => {
    expect(toHexAddress(`xdc${"a1".repeat(20)}`)).toBe(ACCOUNT);
    expect(() => toHexAddress("nope")).toThrow(WalletError);
  });
});

describe("networks", () => {
  it("names the XDC networks only", () => {
    expect(networkName(50)).toBe("XDC mainnet");
    expect(networkName(51)).toBe("Apothem testnet");
    expect(networkName(1)).toBeNull();
  });

  it("reads hex and decimal chain IDs", async () => {
    expect(await currentChainId(providerWith("0x33"))).toBe(51);
    expect(await currentChainId(providerWith("50"))).toBe(50);
  });

  it("switches to a network the wallet knows", async () => {
    const provider = providerWith(null);
    await switchNetwork(provider, APOTHEM);
    expect(provider.request).toHaveBeenCalledOnce();
    expect(provider.request).toHaveBeenCalledWith({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x33" }] });
  });

  it("adds a network the wallet doesn't know", async () => {
    const provider = providerWith({ code: 4902, message: "unknown" }, null);
    await switchNetwork(provider, APOTHEM);
    const added = provider.request.mock.calls[1][0];
    expect(added.method).toBe("wallet_addEthereumChain");
    expect(added.params[0]).toMatchObject({ chainId: "0x33", rpcUrls: [APOTHEM.rpcUrl] });
  });

  it("explains a declined switch and passes on other failures", async () => {
    await expect(switchNetwork(providerWith({ code: 4001, message: "no" }), APOTHEM)).rejects.toThrow("declined");
    await expect(switchNetwork(providerWith(new Error("broken")), APOTHEM)).rejects.toThrow("broken");
  });
});

describe("connecting", () => {
  it("returns the first account", async () => {
    expect(await connect(providerWith([ACCOUNT, CONTRACT]))).toBe(ACCOUNT);
  });

  it("explains a declined connection", async () => {
    await expect(connect(providerWith({ code: 4001, message: "no" }))).rejects.toThrow("declined");
  });

  it("refuses an empty reply", async () => {
    await expect(connect(providerWith([]))).rejects.toThrow("did not share");
  });

  it("reads an existing connection without asking for one", async () => {
    const provider = providerWith([]);
    expect(await currentAccount(provider)).toBeNull();
    expect(provider.request).toHaveBeenCalledWith({ method: "eth_accounts" });
  });
});

describe("checkLogin", () => {
  it("sends the selector with the account and contract", async () => {
    const provider = providerWith(TRUE);
    expect(await checkLogin(provider, `xdc${"a1".repeat(20)}`, CONTRACT)).toBe("allowed");
    expect(provider.request).toHaveBeenCalledWith({
      method: "eth_call",
      params: [{ from: ACCOUNT, to: CONTRACT, data: CHECK_LOGIN_SELECTOR }, "latest"],
    });
  });

  it("treats the contract's revert as refused", async () => {
    const provider = providerWith({ code: -32000, message: "execution reverted: require Login token to login" });
    expect(await checkLogin(provider, ACCOUNT, CONTRACT)).toBe("refused");
  });

  it("does not report a login from an address with no contract", async () => {
    await expect(checkLogin(providerWith("0x"), ACCOUNT, CONTRACT)).rejects.toThrow("did not answer");
  });

  it("does not report a login from a false or malformed answer", async () => {
    await expect(checkLogin(providerWith(`0x${"0".repeat(64)}`), ACCOUNT, CONTRACT)).rejects.toThrow("did not answer");
    await expect(checkLogin(providerWith(null), ACCOUNT, CONTRACT)).rejects.toThrow("did not answer");
  });

  it("reports other failures as failures, not as refusals", async () => {
    await expect(checkLogin(providerWith(new Error("network down")), ACCOUNT, CONTRACT)).rejects.toThrow("network down");
  });

  it("refuses bad addresses before calling the wallet", async () => {
    const provider = providerWith();
    await expect(checkLogin(provider, ACCOUNT, "nope")).rejects.toThrow("not a valid address");
    expect(provider.request).not.toHaveBeenCalled();
  });
});
