import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const required = ['ORACLE_PRIVATE_KEY', 'MONAD_RPC_URL', 'ORACLE_SECRET'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.MONAD_RPC_URL!] },
    public: { http: [process.env.MONAD_RPC_URL!] },
  },
} as const;

export const account = privateKeyToAccount(process.env.ORACLE_PRIVATE_KEY as `0x${string}`);

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(process.env.MONAD_RPC_URL),
});

export const walletClient = createWalletClient({
  account,
  chain: monadTestnet,
  transport: http(process.env.MONAD_RPC_URL),
});

export const VISTA_STREAM_ABI = [
  {
    type: 'function',
    name: 'startStream',
    inputs: [
      { name: 'sessionId', type: 'bytes32' },
      { name: 'campaignId', type: 'bytes32' },
      { name: 'userWallet', type: 'address' },
      { name: 'publisherWallet', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'tickStream',
    inputs: [
      { name: 'sessionId', type: 'bytes32' },
      { name: 'secondsElapsed', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'endStream',
    inputs: [{ name: 'sessionId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'StreamTick',
    inputs: [
      { name: 'sessionId', type: 'bytes32', indexed: true },
      { name: 'userWallet', type: 'address', indexed: false },
      { name: 'publisherWallet', type: 'address', indexed: false },
      { name: 'totalAmount', type: 'uint256', indexed: false },
      { name: 'userAmount', type: 'uint256', indexed: false },
      { name: 'publisherAmount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
] as const;

let deployments: { VistaStream: string; VistaEscrow: string };
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  deployments = require('../deployments.json');
} catch {
  throw new Error(
    'deployments.json not found. Copy it from vista-contracts/ after deploying:\n' +
    '  cp ../vista-contracts/deployments.json ./deployments.json'
  );
}

export const VISTA_STREAM_ADDRESS = deployments.VistaStream as `0x${string}`;
