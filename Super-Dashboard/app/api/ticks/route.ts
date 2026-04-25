import { z } from "zod"

import { assertOracleSecret, jsonError, jsonOk } from "@/lib/api"
import { recordTick } from "@/lib/data"

const schema = z.object({
  sessionIdOnchain: z.string().min(10),
  userWallet: z.string().min(6),
  publisherWallet: z.string().min(6),
  userAmount: z.number().nonnegative(),
  publisherAmount: z.number().nonnegative(),
  totalAmount: z.number().nonnegative(),
  secondsElapsed: z.number().int().positive(),
  blockTimestamp: z.string().min(10),
})

export async function POST(request: Request) {
  try {
    assertOracleSecret(request)
    const parsed = schema.parse(await request.json())
    const tick = await recordTick(parsed)
    return jsonOk(tick, 201)
  } catch (error) {
    return jsonError(error)
  }
}
