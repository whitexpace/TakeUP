import { t } from "./init"
import { requireUser } from "./middleware/auth"

export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(requireUser)
