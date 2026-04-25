import { z } from "zod"

import { jsonError, jsonOk } from "@/lib/api"
import { createPublisher } from "@/lib/data"

const schema = z.object({
  walletAddress: z.string().min(6),
  platformName: z.string().min(2),
})

export async function POST(request: Request) {
  try {
    const parsed = schema.parse(await request.json())
    const publisher = await createPublisher(parsed)
    return jsonOk(publisher, 201)
  } catch (error) {
    return jsonError(error)
  }
}
