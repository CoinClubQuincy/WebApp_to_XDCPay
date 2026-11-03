/** The standard interface (EIP-1193) that browser wallets, including XDCPay, add to the page. */
export interface WalletProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: never[]) => void): void;
  removeListener?(event: string, listener: (...args: never[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: WalletProvider;
  }
}

export interface Network {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
}

export const APOTHEM: Network = {
  name: "Apothem testnet",
  chainId: 51,
  rpcUrl: "https://rpc.apothem.network",
  explorerUrl: "https://testnet.xdcscan.com",
};

export const MAINNET: Network = {
  name: "XDC mainnet",
  chainId: 50,
  rpcUrl: "https://rpc.xinfin.network",
  explorerUrl: "https://xdcscan.com",
};

/** The first four bytes of keccak256("checkLogin()"). A Foundry test keeps this in step with the contract. */
export const CHECK_LOGIN_SELECTOR = "0x3221ff8a";

const USER_REJECTED = 4001;
const UNKNOWN_CHAIN = 4902;
const ABI_TRUE = `0x${"0".repeat(63)}1`;
const ADDRESS = /^(xdc|0x)[0-9a-fA-F]{40}$/;

export type LoginResult = "allowed" | "refused";

export class WalletError extends Error {}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error);
}

function codeOf(error: unknown): unknown {
  return (error as { code?: unknown })?.code;
}

export function isAddress(value: string): boolean {
  return ADDRESS.test(value);
}

/** XDC tools often write addresses as xdc123..., but RPC calls need 0x123.... */
export function toHexAddress(value: string): string {
  if (!isAddress(value)) {
    throw new WalletError("That is not a valid address");
  }
  return value.replace(/^xdc/, "0x");
}

export function networkName(chainId: number): string | null {
  return [APOTHEM, MAINNET].find((network) => network.chainId === chainId)?.name ?? null;
}

export async function connect(provider: WalletProvider): Promise<string> {
  try {
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    if (!Array.isArray(accounts) || typeof accounts[0] !== "string") {
      throw new WalletError("The wallet did not share an account");
    }
    return accounts[0];
  } catch (error) {
    if (codeOf(error) === USER_REJECTED) {
      throw new WalletError("The connection was declined in the wallet");
    }
    throw error;
  }
}

export async function currentAccount(provider: WalletProvider): Promise<string | null> {
  const accounts = await provider.request({ method: "eth_accounts" });
  return Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null;
}

export async function currentChainId(provider: WalletProvider): Promise<number> {
  return Number(await provider.request({ method: "eth_chainId" }));
}

export async function switchNetwork(provider: WalletProvider, network: Network): Promise<void> {
  const chainId = `0x${network.chainId.toString(16)}`;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (error) {
    if (codeOf(error) === USER_REJECTED) {
      throw new WalletError("The network change was declined in the wallet");
    }
    if (codeOf(error) !== UNKNOWN_CHAIN) {
      throw error;
    }
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: network.name,
          nativeCurrency: { name: "XDC", symbol: "XDC", decimals: 18 },
          rpcUrls: [network.rpcUrl],
          blockExplorerUrls: [network.explorerUrl],
        },
      ],
    });
  }
}

/** Asks the contract whether this account holds the login token. The contract reverts if it doesn't. */
export async function checkLogin(provider: WalletProvider, account: string, contract: string): Promise<LoginResult> {
  let result: unknown;
  try {
    result = await provider.request({
      method: "eth_call",
      params: [{ from: toHexAddress(account), to: toHexAddress(contract), data: CHECK_LOGIN_SELECTOR }, "latest"],
    });
  } catch (error) {
    if (error instanceof WalletError) {
      throw error;
    }
    if (/revert|require Login token/i.test(messageOf(error))) {
      return "refused";
    }
    throw new WalletError(`The check failed: ${messageOf(error)}`);
  }
  if (result !== ABI_TRUE) {
    throw new WalletError("That address did not answer like a login token contract. Check the address and network");
  }
  return "allowed";
}
