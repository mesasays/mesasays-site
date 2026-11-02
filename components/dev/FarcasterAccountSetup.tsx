"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeAbiParameters,
  formatEther,
  getAddress,
  http,
  parseAbi,
  parseEther,
  type Hex,
} from "viem";
import { mainnet, optimism } from "viem/chains";

// Creates the MesaSays Farcaster account, step by step, with Jules' wallet:
//   0. connect the custody address 0xA730…0350
//   1. if needed, move a little ETH from Ethereum to Optimism (official bridge contract, no third-party site)
//   2. register a Farcaster id (fid) on Optimism, IdGateway.register
//   3. sign the key request (free signature, no transaction)
//   4. add the app key, KeyGateway.add
// Every transaction is simulated first; the wallet shows the exact amount before Jules signs.
// Contract addresses and functions checked on 2026-11-01 against @farcaster/core 0.20.0 and on chain.

const CUSTODY = getAddress("0xA730C2926E1d4aD3E6B91e1c12Db787645250350");
const ID_GATEWAY = "0x00000000Fc25870C6eD6b6c7E41Fb078b7656f69";
const ID_REGISTRY = "0x00000000Fc6c5F01Fc30151999387Bb99A9f489b";
const KEY_GATEWAY = "0x00000000fC56947c7E7183f8Ca4B62398CaAdf0B";
const KEY_REGISTRY = "0x00000000fc1237824fb747abde0ff18990e59b7e";
const KEY_VALIDATOR = "0x00000000FC700472606ED4fA22623Acf62c60553";
const L1_BRIDGE = "0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1"; // OP Mainnet L1StandardBridge (twin: 0x4200…0010)

const ABI = parseAbi([
  "function price() view returns (uint256)",
  "function register(address recovery) payable returns (uint256 fid, uint256 overpayment)",
  "function idOf(address owner) view returns (uint256)",
  "function add(uint32 keyType, bytes key, uint8 metadataType, bytes metadata)",
  "function keyDataOf(uint256 fid, bytes key) view returns ((uint8 state, uint32 keyType))",
  "function depositETH(uint32 minGasLimit, bytes extraData) payable",
]);

const DEPOSIT = parseEther("0.0005");
const ZERO = BigInt(0);
const op = createPublicClient({ chain: optimism, transport: http("https://mainnet.optimism.io") });
const l1 = createPublicClient({ chain: mainnet, transport: http("https://ethereum-rpc.publicnode.com") });

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
type Announced = { info: { uuid: string; name: string; rdns: string }; provider: Eip1193 };
// Several wallets can be installed (here Rabby and MetaMask): window.ethereum is whichever grabbed it last.
// The wallet Jules picks (EIP-6963 discovery) is used for every call; window.ethereum only as a last resort.
let chosen: Eip1193 | null = null;
const provider = () => chosen ?? (typeof window === "undefined" ? null : ((window as unknown as { ethereum?: Eip1193 }).ethereum ?? null));

type State = {
  opBalance: bigint;
  l1Balance: bigint;
  price: bigint;
  fid: bigint;
  keyAdded: boolean;
};

async function switchTo(chain: typeof mainnet | typeof optimism) {
  const wallet = provider();
  if (!wallet) throw new Error("Aucun portefeuille dans ce navigateur.");
  const id = `0x${chain.id.toString(16)}`;
  try {
    await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: id }] });
  } catch (error) {
    // 4902 = the wallet does not know the chain yet.
    if ((error as { code?: number }).code !== 4902) throw error;
    await wallet.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: id, chainName: chain.name, nativeCurrency: chain.nativeCurrency, rpcUrls: chain.rpcUrls.default.http }],
    });
  }
  // Some wallets accept the request but stay put: check, and say so plainly instead of failing later.
  const now = String(await wallet.request({ method: "eth_chainId" })).toLowerCase();
  if (now !== id) throw new Error(`Le portefeuille est resté sur un autre réseau (${now}). Passe-le à la main sur « ${chain.name} », puis reclique.`);
}

const wallet = (chain: typeof mainnet | typeof optimism) => createWalletClient({ account: CUSTODY, chain, transport: custom(provider()!) });
const eth = (value: bigint) => `${Number(formatEther(value)).toFixed(6)} ETH`;
const short = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-6)}`;

export function FarcasterAccountSetup({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string>(CUSTODY);
  const say = (line: string) => setLog((lines) => [...lines, line]);
  const [wallets, setWallets] = useState<Announced[]>([]);

  // EIP-6963: each installed wallet announces itself; list them so Jules picks the one holding 0xA730.
  useEffect(() => {
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Announced>).detail;
      setWallets((list) => (list.some((item) => item.info.uuid === detail.info.uuid) ? list : [...list, detail]));
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", onAnnounce);
  }, []);

  // The connected address lives on its own: a balance refresh must never reset it
  // (it did: run() refreshed with a stale "not connected" state, so Connect looked like it did nothing).
  const [account, setAccount] = useState<`0x${string}` | null>(null);

  // Reads balances and account state; returns them without touching React state.
  const load = useCallback(async (): Promise<State> => {
    const [opBalance, l1Balance, price, fid] = await Promise.all([
      op.getBalance({ address: CUSTODY }),
      l1.getBalance({ address: CUSTODY }),
      op.readContract({ address: ID_GATEWAY, abi: ABI, functionName: "price" }),
      op.readContract({ address: ID_REGISTRY, abi: ABI, functionName: "idOf", args: [CUSTODY] }),
    ]);
    const keyAdded =
      fid > ZERO && publicKey
        ? (await op.readContract({ address: KEY_REGISTRY, abi: ABI, functionName: "keyDataOf", args: [fid, publicKey as Hex] })).state === 1
        : false;
    return { opBalance, l1Balance, price, fid, keyAdded };
  }, [publicKey]);

  const refresh = useCallback(async () => setState(await load()), [load]);

  useEffect(() => {
    let live = true;
    load().then(
      (value) => live && setState(value),
      () => live && setError("Lecture des soldes impossible (réseau). Recharge la page."),
    );
    return () => {
      live = false;
    };
  }, [load]);

  async function run(label: string, step: () => Promise<void>) {
    setError(null);
    setBusy(label);
    try {
      await step();
    } catch (problem) {
      const message = (problem as { shortMessage?: string; message?: string }).shortMessage ?? (problem as Error).message ?? "erreur";
      setError(/reject|denied|cancel/i.test(message) ? "Annulé dans le portefeuille. Rien n'a été envoyé." : message);
    } finally {
      setBusy(null);
      await refresh().catch(() => undefined);
    }
  }

  const connect = (picked: Eip1193 | null) =>
    run("connexion", async () => {
      if (picked) chosen = picked;
      if (!provider()) throw new Error("Aucun portefeuille trouvé dans ce navigateur.");
      const accounts = (await provider()!.request({ method: "eth_requestAccounts" })) as string[];
      const account = accounts?.[0] ? getAddress(accounts[0]) : null;
      if (account !== CUSTODY) throw new Error(`Le portefeuille est sur ${account ?? "aucun compte"} : choisis l'adresse MesaSays ${CUSTODY}.`);
      setAccount(account);
    });

  const deposit = () =>
    run("envoi vers Optimism", async () => {
      await switchTo(mainnet);
      // Simulated first: the call would fail here, before the wallet opens, if anything were wrong.
      await l1.simulateContract({ account: CUSTODY, address: L1_BRIDGE, abi: ABI, functionName: "depositETH", args: [200_000, "0x"], value: DEPOSIT });
      const hash = await wallet(mainnet).writeContract({ address: L1_BRIDGE, abi: ABI, functionName: "depositETH", args: [200_000, "0x"], value: DEPOSIT });
      say(`Envoi vers Optimism parti (Ethereum ${short(hash)}). Arrivée en 1 à 3 minutes.`);
      await l1.waitForTransactionReceipt({ hash });
      say("Confirmé sur Ethereum. J'attends l'arrivée sur Optimism…");
      for (let i = 0; i < 40; i += 1) {
        if ((await op.getBalance({ address: CUSTODY })) > ZERO) return say("Les ETH sont arrivés sur Optimism.");
        await new Promise((resolve) => setTimeout(resolve, 10_000));
      }
      say("Toujours rien sur Optimism après ~7 minutes : recharge la page un peu plus tard.");
    });

  const register = () =>
    run("création du compte", async () => {
      const to = getAddress(recovery);
      await switchTo(optimism);
      const price = await op.readContract({ address: ID_GATEWAY, abi: ABI, functionName: "price" });
      // 5 % margin in case the price moves between reading and signing; the contract refunds the excess.
      const value = (price * BigInt(105)) / BigInt(100);
      await op.simulateContract({ account: CUSTODY, address: ID_GATEWAY, abi: ABI, functionName: "register", args: [to], value });
      const hash = await wallet(optimism).writeContract({ address: ID_GATEWAY, abi: ABI, functionName: "register", args: [to], value });
      say(`Création envoyée (Optimism ${short(hash)}).`);
      const receipt = await op.waitForTransactionReceipt({ hash });
      // Read at the transaction's own block: a public node a block behind would still answer 0.
      const fid = await op.readContract({ address: ID_REGISTRY, abi: ABI, functionName: "idOf", args: [CUSTODY], blockNumber: receipt.blockNumber });
      say(`Compte créé : fid ${fid}.`);
    });

  const addKey = () =>
    run("ajout de la clé", async () => {
      if (!publicKey || !state?.fid) throw new Error("Il manque le fid ou la clé d'application.");
      await switchTo(optimism);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      // Free signature (no transaction): "account <fid> allows this app key".
      const signature = await wallet(optimism).signTypedData({
        domain: { name: "Farcaster SignedKeyRequestValidator", version: "1", chainId: 10, verifyingContract: KEY_VALIDATOR },
        types: { SignedKeyRequest: [{ name: "requestFid", type: "uint256" }, { name: "key", type: "bytes" }, { name: "deadline", type: "uint256" }] },
        primaryType: "SignedKeyRequest",
        message: { requestFid: state.fid, key: publicKey as Hex, deadline },
      });
      const metadata = encodeAbiParameters(
        [{ type: "tuple", components: [{ name: "requestFid", type: "uint256" }, { name: "requestSigner", type: "address" }, { name: "signature", type: "bytes" }, { name: "deadline", type: "uint256" }] }],
        [{ requestFid: state.fid, requestSigner: CUSTODY, signature, deadline }],
      );
      await op.simulateContract({ account: CUSTODY, address: KEY_GATEWAY, abi: ABI, functionName: "add", args: [1, publicKey as Hex, 1, metadata] });
      const hash = await wallet(optimism).writeContract({ address: KEY_GATEWAY, abi: ABI, functionName: "add", args: [1, publicKey as Hex, 1, metadata] });
      say(`Ajout de la clé envoyé (Optimism ${short(hash)}).`);
      await op.waitForTransactionReceipt({ hash });
      say("Clé d'application enregistrée. Le compte MesaSays peut publier.");
    });

  if (!publicKey) {
    return <p className="ms-lede">Il manque la clé d&apos;application : lance <code>node infra/farcaster/new-app-key.mjs</code> puis recharge.</p>;
  }

  const needsEth = state ? state.opBalance < state.price * BigInt(2) : true;
  const done = Boolean(state?.keyAdded);
  return (
    <div className="ms-prose" style={{ overflowWrap: "anywhere" }}>
      <p>
        Adresse MesaSays (garde du compte) : <code>{CUSTODY}</code>
        <br />
        Clé d&apos;application (publique) : <code>{publicKey}</code>
      </p>
      {state ? (
        <ul>
          <li>Solde sur Ethereum : {eth(state.l1Balance)}</li>
          <li>Solde sur Optimism : {eth(state.opBalance)}</li>
          <li>Prix de création du compte : {eth(state.price)} (≈ 0,20 USD)</li>
          <li>Compte Farcaster : {state.fid > ZERO ? `fid ${state.fid}` : "pas encore créé"}</li>
          <li>Clé d&apos;application : {done ? "enregistrée" : "pas encore enregistrée"}</li>
        </ul>
      ) : (
        <p>Lecture des soldes…</p>
      )}

      <h2>0. Connecter le portefeuille</h2>
      <p>Choisis l&apos;adresse MesaSays (0xA730…0350), pas celle du trading.</p>
      {account ? (
        <p><strong>Connecté</strong> à {CUSTODY}.</p>
      ) : wallets.length ? (
        wallets.map((item) => (
          <button key={item.info.uuid} type="button" className="ms-button" disabled={Boolean(busy)} onClick={() => connect(item.provider)}>
            Connecter avec {item.info.name}
          </button>
        ))
      ) : (
        <button type="button" className="ms-button" disabled={Boolean(busy)} onClick={() => connect(null)}>Connecter</button>
      )}

      {account && state && needsEth && state.fid === ZERO ? (
        <>
          <h2>1. Envoyer un peu d&apos;ETH d&apos;Ethereum vers Optimism</h2>
          <p>
            0,0005 ETH (≈ 1,15 USD) passent par le pont officiel d&apos;Optimism ; ils restent à toi sur la même adresse.
            Frais : quelques centimes. Ton portefeuille te montre le montant exact avant de signer.
          </p>
          <button type="button" className="ms-button" disabled={Boolean(busy)} onClick={deposit}>Envoyer 0,0005 ETH vers Optimism</button>
        </>
      ) : null}

      {account && state && !needsEth && state.fid === ZERO ? (
        <>
          <h2>2. Créer le compte Farcaster</h2>
          <p>
            Adresse de secours (peut récupérer le compte si la garde est perdue). Par défaut la même adresse ; mets-en une
            autre si tu en as une sûre, jamais celle du trading.
          </p>
          <input className="ms-input" value={recovery} onChange={(event) => setRecovery(event.target.value.trim())} />
          <button type="button" className="ms-button" disabled={Boolean(busy)} onClick={register}>Créer le compte (≈ 0,20 USD)</button>
        </>
      ) : null}

      {account && state && state.fid > ZERO && !done ? (
        <>
          <h2>3 et 4. Autoriser la clé d&apos;application</h2>
          <p>D&apos;abord une signature gratuite (« le compte {String(state.fid)} autorise cette clé »), puis une transaction à quelques centimes.</p>
          <button type="button" className="ms-button" disabled={Boolean(busy)} onClick={addKey}>Signer puis enregistrer la clé</button>
        </>
      ) : null}

      {done ? <p><strong>Terminé.</strong> Compte MesaSays : fid {String(state?.fid)}. Dis-le à Claude pour la suite (nom, chaîne, mise en ligne).</p> : null}
      {busy ? <p>En cours : {busy}… regarde ton portefeuille.</p> : null}
      {error ? <p className="say-error" role="alert">{error}</p> : null}
      {log.length ? <pre className="say-json">{log.join("\n")}</pre> : null}
    </div>
  );
}
