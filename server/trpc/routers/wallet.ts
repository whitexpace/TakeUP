import { router } from "../init"
import { protectedProcedure } from "../procedures"
import {
  getOrCreateWallet,
  topUpPseudo,
  payWithWallet,
  getWalletTransactions,
} from "../../utils/wallet"
import { topUpSchema, payWithWalletSchema, listTransactionsSchema } from "#shared/schemas/wallet"

export const walletRouter = router({
  getWallet: protectedProcedure.query(async ({ ctx }) => {
    return await getOrCreateWallet(ctx.user.id)
  }),

  topUp: protectedProcedure.input(topUpSchema).mutation(async ({ ctx, input }) => {
    return await topUpPseudo(ctx.user.id, input.amount)
  }),

  pay: protectedProcedure.input(payWithWalletSchema).mutation(async ({ ctx, input }) => {
    const { amount, relatedEntityType, relatedEntityId } = input
    return await payWithWallet(ctx.user.id, amount, {
      relatedEntityType,
      relatedEntityId,
    })
  }),

  transactions: protectedProcedure.input(listTransactionsSchema).query(async ({ ctx, input }) => {
    return await getWalletTransactions(ctx.user.id, {
      skip: input.skip,
      take: input.take,
    })
  }),
})
