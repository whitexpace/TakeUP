export type AppHeaderNotification = {
  id: string | number
  title: string
  body: string
  createdAt: Date
  read: boolean
  actionPath?: string | null
}
