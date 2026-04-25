import { isAddress, parseAbi, type Address } from "viem"

export const erc20Abi = parseAbi([
  "function approve(address spender, uint256 value) external returns (bool)",
])

export const vistaEscrowAbi = parseAbi([
  "function deposit(bytes32 campaignId, uint256 amount, uint256 ratePerSecond, uint256 duration) external",
  "function refundRemaining(bytes32 campaignId) external",
])

const rawContracts = {
  vistaStream: process.env.NEXT_PUBLIC_VISTA_STREAM_ADDRESS,
  vistaEscrow: process.env.NEXT_PUBLIC_VISTA_ESCROW_ADDRESS,
  mockUsdc: process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS,
}

export const contractAddresses = {
  vistaStream: isAddress(rawContracts.vistaStream ?? "") ? (rawContracts.vistaStream as Address) : null,
  vistaEscrow: isAddress(rawContracts.vistaEscrow ?? "") ? (rawContracts.vistaEscrow as Address) : null,
  mockUsdc: isAddress(rawContracts.mockUsdc ?? "") ? (rawContracts.mockUsdc as Address) : null,
}

export const hasContractConfig = Boolean(
  contractAddresses.vistaEscrow && contractAddresses.mockUsdc
)
