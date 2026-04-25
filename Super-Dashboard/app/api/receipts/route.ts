import { z } from "zod"

import { assertOracleSecret, jsonError, jsonOk } from "@/lib/api"
import { createReceipt } from "@/lib/data"

const schema = z.object({
  tokenId: z.string().min(1),
  sessionIdOnchain: z.string().min(10),
  userWallet: z.string().min(6),
  advertiserWallet: z.string().min(6),
  campaignIdOnchain: z.string().min(10),
  secondsVerified: z.number().int().nonnegative(),
  usdcPaid: z.number().nonnegative(),
  mintedAt: z.string().min(10),
})

export async function POST(request: Request) {
  try {
    assertOracleSecret(request)
    const parsed = schema.parse(await request.json())
    const receipt = await createReceipt(parsed)
    return jsonOk(receipt, 201)
  } catch (error) {
    return jsonError(error)
  }
}
