import { createClient } from "@supabase/supabase-js"
import type { H3Event } from "h3"

type CommunityFeedEventPayload = {
  type:
    | "request-created"
    | "request-updated"
    | "request-deleted"
    | "offer-created"
    | "offer-updated"
    | "offer-deleted"
    | "reply-created"
    | "reply-upvote-toggled"
  requestId: number
  replyId?: string
  actorUserId?: string
}

const communityFeedTopic = "community-feed"
const communityRequestTopic = (requestId: number) => `community-request-${requestId}`

export const broadcastCommunityFeedEvent = async (
  event: H3Event,
  payload: CommunityFeedEventPayload,
) => {
  let runtimeConfig: ReturnType<typeof useRuntimeConfig>
  try {
    runtimeConfig = useRuntimeConfig(event)
  } catch {
    return
  }

  const supabaseUrl = runtimeConfig.public.supabase?.url
  const serviceRoleKey = runtimeConfig.supabaseServiceRoleKey

  if (!supabaseUrl || !serviceRoleKey) {
    return
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const topics = [communityFeedTopic, communityRequestTopic(payload.requestId)]

  await Promise.allSettled(
    topics.map((topic) => supabase.channel(topic).httpSend("message", payload)),
  )
}
