import type { Prisma, ReviewType as PrismaReviewType } from "@prisma/client"
import type { ReviewType } from "../../shared/schemas/review"

export const transactionReviewUserSelect = {
  id: true,
  username: true,
  firstName: true,
  middleName: true,
  lastName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect

export const transactionReviewSelect = {
  id: true,
  transactionId: true,
  reviewerUserId: true,
  reviewType: true,
  revieweeUserId: true,
  itemId: true,
  rating: true,
  reviewText: true,
  images: true,
  isAnonymous: true,
  createdAt: true,
  reviewerUser: {
    select: transactionReviewUserSelect,
  },
  revieweeUser: {
    select: transactionReviewUserSelect,
  },
} satisfies Prisma.TransactionReviewSelect

type TransactionReviewRecord = Prisma.TransactionReviewGetPayload<{
  select: typeof transactionReviewSelect
}>

type ReviewParticipant = {
  id: string
  username: string
  firstName: string
  middleName: string | null
  lastName: string
  avatarUrl: string | null
}

type ReviewStateInput = {
  status: string
  itemId?: string | null
  borrowerId: string | null
  lenderId: string | null
  currentUserId: string
  existingReviewTypes?: ReviewType[]
}

const reviewActionByType: Record<
  ReviewType,
  {
    label: string
    submittedLabel: string
  }
> = {
  ITEM_REVIEW: {
    label: "Review Item",
    submittedLabel: "Item Review Submitted",
  },
  LENDER_REVIEW: {
    label: "Review Lender",
    submittedLabel: "Lender Review Submitted",
  },
  BORROWER_REVIEW: {
    label: "Review Borrower",
    submittedLabel: "Borrower Review Submitted",
  },
}

const buildPersonName = (user: Pick<ReviewParticipant, "firstName" | "lastName">) =>
  `${user.firstName} ${user.lastName[0]}.`

const mapReviewPerson = (user: ReviewParticipant | null | undefined, isAnonymous: boolean) => {
  if (isAnonymous || !user) {
    return {
      id: user?.id ?? null,
      displayName: "Anonymous",
      username: null,
      avatarUrl: null,
    }
  }

  return {
    id: user.id,
    displayName: buildPersonName(user),
    username: user.username,
    avatarUrl: user.avatarUrl,
  }
}

export const mapTransactionReview = (review: TransactionReviewRecord) => ({
  id: review.id,
  transactionId: review.transactionId,
  reviewerUserId: review.reviewerUserId,
  reviewType: review.reviewType,
  revieweeUserId: review.revieweeUserId,
  itemId: review.itemId,
  rating: review.rating,
  reviewText: review.reviewText,
  images: review.images,
  isAnonymous: review.isAnonymous,
  createdAt: review.createdAt,
  typeLabel: reviewActionByType[review.reviewType].label,
  reviewer: mapReviewPerson(review.reviewerUser, review.isAnonymous),
  reviewee: review.revieweeUser
    ? {
        id: review.revieweeUser.id,
        displayName: buildPersonName(review.revieweeUser),
        username: review.revieweeUser.username,
        avatarUrl: review.revieweeUser.avatarUrl,
      }
    : null,
})

const getReviewTypesForUserRole = (
  input: Pick<ReviewStateInput, "itemId" | "borrowerId" | "lenderId" | "currentUserId">,
): ReviewType[] => {
  if (input.currentUserId === input.borrowerId) {
    return [input.itemId ? "ITEM_REVIEW" : null, "LENDER_REVIEW"].filter(
      (reviewType): reviewType is ReviewType => reviewType !== null,
    )
  }

  if (input.currentUserId === input.lenderId) {
    return ["BORROWER_REVIEW"]
  }

  return []
}

export const getAllowedReviewTypesForTransaction = getReviewTypesForUserRole

export const buildTransactionReviewState = (input: ReviewStateInput) => {
  const isParticipant =
    input.currentUserId === input.borrowerId || input.currentUserId === input.lenderId
  const isCompleted = input.status === "COMPLETED"
  const allowedTypes = getReviewTypesForUserRole(input)
  const submittedTypes = new Set(input.existingReviewTypes ?? [])

  const actions = allowedTypes.map((reviewType) => ({
    reviewType,
    label: reviewActionByType[reviewType].label,
    submittedLabel: reviewActionByType[reviewType].submittedLabel,
    hasSubmitted: submittedTypes.has(reviewType),
    canSubmit: isParticipant && isCompleted && !submittedTypes.has(reviewType),
  }))

  return {
    isParticipant,
    isCompleted,
    allowedTypes,
    actions,
    canSubmitAny: actions.some((action) => action.canSubmit),
  }
}

export const isReviewTypeAllowedForTransaction = (
  reviewType: PrismaReviewType,
  input: Pick<ReviewStateInput, "itemId" | "borrowerId" | "lenderId" | "currentUserId">,
) => getReviewTypesForUserRole(input).includes(reviewType)
