export const MONAD_CHAIN_ID = 10143;
export const MONAD_RPC_URL = 'https://testnet-rpc.monad.xyz';
export const MONAD_EXPLORER_URL = 'https://testnet.monadexplorer.com';

export interface WalletAuthMessageParams {
  domain: string;
  uri: string;
  address: string;
  nonce: string;
  chainId: number;
  issuedAt: string;
}

export function buildWalletAuthMessage(params: WalletAuthMessageParams): string {
  const { domain, uri, address, nonce, chainId, issuedAt } = params;
  return [
    'Sign in to Farcaster Monad App',
    `Domain: ${domain}`,
    `URI: ${uri}`,
    `Address: ${address}`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    'Statement: This signature proves wallet ownership.',
  ].join('\n');
}

export interface WalletSignInParams {
  address: string;
  chainId: number;
  targetChainId?: number;
  domain: string;
  uri: string;
  nonceEndpoint: string;
  verifyEndpoint: string;
  switchChain?: (chainId: number) => Promise<{ id: number }>;
  signMessage: (message: string) => Promise<string>;
}

export async function performWalletSignIn(params: WalletSignInParams): Promise<void> {
  const {
    address,
    chainId,
    targetChainId = MONAD_CHAIN_ID,
    domain,
    uri,
    nonceEndpoint,
    verifyEndpoint,
    switchChain,
    signMessage,
  } = params;

  let activeChainId = chainId;

  if (activeChainId !== targetChainId && switchChain) {
    const switched = await switchChain(targetChainId);
    activeChainId = switched.id;
  }

  if (activeChainId !== targetChainId) {
    throw new Error('Wrong chain');
  }

  const nonceResponse = await fetch(nonceEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });

  const noncePayload = await nonceResponse.json();
  if (!nonceResponse.ok || !noncePayload?.nonce) {
    throw new Error(noncePayload?.error ?? 'Failed nonce');
  }

  const issuedAt = new Date().toISOString();
  const message = buildWalletAuthMessage({
    domain,
    uri,
    address,
    nonce: noncePayload.nonce,
    chainId: activeChainId,
    issuedAt,
  });

  const signature = await signMessage(message);

  const verifyResponse = await fetch(verifyEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address,
      nonce: noncePayload.nonce,
      chainId: activeChainId,
      message,
      signature,
    }),
  });

  const verifyPayload = await verifyResponse.json();
  if (!verifyResponse.ok) {
    throw new Error(verifyPayload?.error ?? 'Verify failed');
  }
}
