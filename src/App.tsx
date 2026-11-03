import { useCallback, useEffect, useState } from "react";
import {
  APOTHEM,
  checkLogin,
  connect,
  currentAccount,
  currentChainId,
  isAddress,
  networkName,
  switchNetwork,
  type LoginResult,
  type WalletProvider,
} from "./wallet";

const INSTALL_URL = "https://chrome.google.com/webstore/detail/xdcpay/bocpokimicclpaiekenaeelehdjllofo";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong in the wallet";
}

export function App() {
  const provider: WalletProvider | undefined = window.ethereum;
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [contract, setContract] = useState<string>(import.meta.env.VITE_LOGIN_TOKEN_ADDRESS ?? "");
  const [login, setLogin] = useState<LoginResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!provider) {
      return;
    }
    let active = true;
    const onAccounts = (accounts: string[]) => {
      setAccount(accounts[0] ?? null);
      setLogin(null);
    };
    const onChain = (chain: string) => {
      setChainId(Number(chain));
      setLogin(null);
    };
    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);
    Promise.all([currentAccount(provider), currentChainId(provider)])
      .then(([existing, chain]) => {
        if (active) {
          setAccount(existing);
          setChainId(chain);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(errorText(caught));
        }
      });
    return () => {
      active = false;
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [provider]);

  const act = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  if (!provider) {
    return (
      <main>
        <h1>Web App to XDCPay</h1>
        <p role="status">No wallet found in this browser.</p>
        <p>
          <a href={INSTALL_URL}>Install XDCPay</a>, then reload this page.
        </p>
      </main>
    );
  }

  const network = chainId === null ? null : networkName(chainId);

  return (
    <main>
      <h1>Web App to XDCPay</h1>
      {!account ? (
        <button
          disabled={busy}
          onClick={() =>
            act(async () => {
              setAccount(await connect(provider));
              setChainId(await currentChainId(provider));
            })
          }
        >
          Connect wallet
        </button>
      ) : (
        <>
          <dl>
            <dt>Account</dt>
            <dd>{account}</dd>
            <dt>Network</dt>
            <dd>{network ?? `Unknown network (${chainId ?? "not read"})`}</dd>
          </dl>
          {!network && (
            <button disabled={busy} onClick={() => act(() => switchNetwork(provider, APOTHEM))}>
              Switch to {APOTHEM.name}
            </button>
          )}
          <label htmlFor="contract">Login token contract</label>
          <input
            id="contract"
            value={contract}
            placeholder="0x..."
            spellCheck={false}
            onChange={(event) => {
              setContract(event.target.value.trim());
              setLogin(null);
            }}
          />
          <button
            disabled={busy || !isAddress(contract)}
            onClick={() =>
              act(async () => {
                setLogin(null);
                setLogin(await checkLogin(provider, account, contract));
              })
            }
          >
            Check login
          </button>
          {login === "allowed" && <p role="status">This account holds the login token.</p>}
          {login === "refused" && <p role="status">This account does not hold the login token.</p>}
          <button
            className="secondary"
            onClick={() => {
              setAccount(null);
              setLogin(null);
              setError(null);
            }}
          >
            Forget this account
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
