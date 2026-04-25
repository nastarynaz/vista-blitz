import { NextResponse } from "next/server"

export class ApiError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  const message = error instanceof Error ? error.message : "Unexpected error."
  return NextResponse.json({ error: message }, { status: 500 })
}

export function assertOracleSecret(request: Request) {
  const expectedSecret = process.env.ORACLE_WEBHOOK_SECRET
  const providedSecret = request.headers.get("x-oracle-secret")

  if (!expectedSecret || providedSecret !== expectedSecret) {
    throw new ApiError("Unauthorized oracle webhook.", 401)
  }
}
