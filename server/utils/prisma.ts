import type { Prisma } from "@prisma/client"
import { PrismaClient } from "@prisma/client"

export type WalletRecord = {
  id: string
  scope: string
  userId: string | null
  systemKey: string | null
  currency: string
  balance: Prisma.Decimal
  status: string
  createdAt: Date
  updatedAt: Date
}

export type WalletTransactionRecord = {
  id: string
  walletId: string
  userId: string | null
  type: string
  method: string
  direction: string
  amount: Prisma.Decimal
  balanceBefore: Prisma.Decimal
  balanceAfter: Prisma.Decimal
  referenceCode: string
  relatedEntityType: string | null
  relatedEntityId: string | null
  status: string
  metadata: Prisma.JsonValue
  createdAt: Date
  updatedAt: Date
}

type WalletDelegate = {
  findUnique(args: unknown): Promise<WalletRecord | null>
  upsert(args: unknown): Promise<WalletRecord>
  create(args: unknown): Promise<WalletRecord>
  update(args: unknown): Promise<WalletRecord>
}

type WalletTransactionDelegate = {
  findFirst(args: unknown): Promise<WalletTransactionRecord | null>
  findMany(args: unknown): Promise<WalletTransactionRecord[]>
  create(args: unknown): Promise<WalletTransactionRecord>
}

export type WalletPrismaAdapter = {
  wallet: WalletDelegate
  walletTransaction: WalletTransactionDelegate
}

export const asWalletPrisma = <T>(client: T) => client as T & WalletPrismaAdapter

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
const runtimeDatabaseUrl = process.env.DATABASE_URL

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: runtimeDatabaseUrl,
    log: ["error", "warn"],
    transactionOptions: {
      maxWait: 10_000,
      timeout: 15_000,
    },
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
