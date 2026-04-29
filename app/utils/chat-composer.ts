export const insertTextAtSelection = (
  currentValue: string,
  insertedText: string,
  selectionStart: number,
  selectionEnd: number,
) => {
  const nextValue =
    currentValue.slice(0, selectionStart) + insertedText + currentValue.slice(selectionEnd)
  const nextCaret = selectionStart + insertedText.length

  return {
    value: nextValue,
    selectionStart: nextCaret,
    selectionEnd: nextCaret,
  }
}
