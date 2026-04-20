export const CHAT_CENSOR_TOKEN = "[censored]"

const PHONE_REGEX =
  /(?:\+63|0)?9\d{9}\b|(?:\+?\d{1,4}[-.\s]?)?\(?\d{3,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/gi

const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi

const PROFANITY_REGEX =
  /\b(?:asshole(?:s)?|bastard(?:s)?|bitch(?:es)?|bullshit|crap|damn(?:ed|ing)?|fuck(?:er|ers|ed|ing|s)?|gago|motherfuck(?:er|ers|ing)?|pakyu|puta|putangina|shit(?:ty|ting|ted|s)?|tanga|tarantado|ulol)\b/gi

const hasPatternMatch = (value: string, pattern: RegExp) => {
  const candidate = pattern.flags.includes("g")
    ? new RegExp(pattern.source, pattern.flags)
    : new RegExp(pattern.source, `${pattern.flags}g`)

  return candidate.test(value)
}

export const containsModeratedContent = (value: string) => {
  return [PHONE_REGEX, EMAIL_REGEX, PROFANITY_REGEX].some((pattern) =>
    hasPatternMatch(value, pattern),
  )
}

export const sanitizeChatMessage = (value: string) => {
  const trimmed = value.trim()

  return [EMAIL_REGEX, PHONE_REGEX, PROFANITY_REGEX].reduce(
    (currentValue, pattern) => currentValue.replace(pattern, CHAT_CENSOR_TOKEN),
    trimmed,
  )
}
