export type ListingMediaSubmit = {
  entries: Array<
    { id: string; type: "existing"; path: string } | { id: string; type: "new"; file: File }
  >
  coverEntryId: string | null
}

export type ListingFormSubmitData = {
  payload: Record<string, unknown>
  media: ListingMediaSubmit
}
