import { t } from "./init"
import { requireAdmin, requireUser } from "./middleware/auth"

export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(requireUser)
export const adminProcedure = t.procedure.use(requireAdmin)
