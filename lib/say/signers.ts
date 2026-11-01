// Addresses we know. A signature proves which address signed, not who the person is: this map is how
// we say "this address is ours". Anyone else is shown by address only. Keys are lowercase.
export type KnownSigner = { label: string; team: boolean };

export const KNOWN_SIGNERS: Record<string, KnownSigner> = {
  "0xa730c2926e1d4ad3e6b91e1c12db787645250350": { label: "jules · mesasays", team: true },
};

export const knownSigner = (address: string): KnownSigner | null => KNOWN_SIGNERS[address.toLowerCase()] ?? null;
