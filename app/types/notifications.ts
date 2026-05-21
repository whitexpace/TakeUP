export type AppHeaderNotificationType =
  | "BOOKING_REQUESTED"
  | "BOOKING_HANDOFF_PROOF_UPLOADED"
  | "BOOKING_RETURN_REQUESTED"
  | "DISPUTE_SUBMITTED"
  | "DISPUTE_OPENED"
  | "DISPUTE_REBUTTAL_SUBMITTED"
  | "DISPUTE_RESOLVED"

export type AppHeaderNotification = {
  id: string | number
  type: AppHeaderNotificationType
  title: string
  body: string
  createdAt: Date
  read: boolean
  actionPath?: string | null
}
