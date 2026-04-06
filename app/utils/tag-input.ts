const normalizeTag = (value: string) => value.trim().toLowerCase()

const isValidTag = (value: string) => /[a-z0-9]/i.test(value)

export const parseTagInput = (value: string) => {
  return value
    .split(/[,\s]+/)
    .map(normalizeTag)
    .filter((tag) => tag.length > 0 && isValidTag(tag))
}

export const mergeParsedTags = (existingTags: string[], rawInput: string) => {
  const nextTags = [...existingTags]

  for (const tag of parseTagInput(rawInput)) {
    if (!nextTags.includes(tag)) {
      nextTags.push(tag)
    }
  }

  return nextTags
}
