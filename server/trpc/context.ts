import type { H3Event } from "h3"
import { prisma } from "../utils/prisma"
import type { SessionUser } from "../utils/auth-session"

export type Context = {
  event: H3Event
  prisma: typeof prisma
  user: SessionUser | null
}

export async function createContext(event: H3Event): Promise<Context> {
  const user = event.context.authUser ?? null
  return { event, prisma, user }
}
