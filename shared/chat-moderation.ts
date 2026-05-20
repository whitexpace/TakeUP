export const CHAT_CENSOR_TOKEN = "[censored]"

const PHONE_REGEX =
  /(?:\+63|0)?9\d{9}\b|(?:\+?\d{1,4}[-.\s]?)?\(?\d{3,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/gi

const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi

const LINK_REGEX =
  /\b(?:(?:https?:\/\/|www\.)[^\s<]+|(?:[a-z0-9-]+\.)+(?:app|biz|co|com|dev|edu|gg|gov|info|io|ly|me|net|org|ph|site|store|xyz)(?:\/[^\s<]*)?)/gi

const PROFANITY_REGEX =
  /\b(?:amaw|animal|animal ka|arse|ass|asshat|asshole(?:s)?|atay|bastard(?:s)?|bayot|bilat|bitch(?:es)?|boang|bollocks|bogo|boobs?|buang|bullshit|burat|bwisit|buwisit|crap|cunt(?:s)?|damn(?:ed|ing)?|demonyo|dick(?:head|s)?|douche(?:bag)?|fuck(?:er|ers|ed|ing|s)?|gaga|gago|gagu|giatay|gunggong|hayop|hell|hinampak|hinayupak|idiot(?:s)?|inutil|jackass(?:es)?|jerk(?:s)?|kagang|kagwang|kantot|kupal|leche|letse|lintik|motherfuck(?:er|ers|ing)?|ogag|olol|pakshet|pakyu|pesteng yawa|peste|pisti|piste|prick(?:s)?|punyeta|pucha|puki|pussy|puta|putangina|putragis|shet|shit(?:ty|ting|ted|s)?|slut(?:s)?|stupid|tanga|tangina|tarantado|timang|ulol|ungas|wakwak|walanghiya|wanker(?:s)?|whore(?:s)?|yawa|yati)\b/gi

const hasPatternMatch = (value: string, pattern: RegExp) => {
  const candidate = pattern.flags.includes("g")
    ? new RegExp(pattern.source, pattern.flags)
    : new RegExp(pattern.source, `${pattern.flags}g`)

  return candidate.test(value)
}

export const containsModeratedContent = (value: string) => {
  return [PHONE_REGEX, EMAIL_REGEX, LINK_REGEX, PROFANITY_REGEX].some((pattern) =>
    hasPatternMatch(value, pattern),
  )
}

export const sanitizeChatMessage = (value: string) => {
  const trimmed = value.trim()

  return [EMAIL_REGEX, PHONE_REGEX, LINK_REGEX, PROFANITY_REGEX].reduce(
    (currentValue, pattern) => currentValue.replace(pattern, CHAT_CENSOR_TOKEN),
    trimmed,
  )
}
