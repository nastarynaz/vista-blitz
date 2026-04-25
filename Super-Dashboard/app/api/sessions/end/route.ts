import { z } from "zod"
import { assertOracleSecret, jsonError, jsonOk } from "@/lib/api"
import { endSession } from "@/lib/data"

const schema = z.object({
  sessionIdOnchain: z.string().min(10),
  secondsVerified: z.number().int().nonnegative(),
  totalPaid: z.number().nonnegative(),
  endedAt: z.string().min(10),
})

export async function POST(request: Request) {
  try {
    assertOracleSecret(request)
    const parsed = schema.parse(await request.json())
    const result = await endSession(parsed)
    return jsonOk(result)
  } catch (error) {
    return jsonError(error)
  }
}
