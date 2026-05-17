export const useAppLoading = () => {
  const isLoading = useState("app-loading", () => true)

  const startLoading = () => {
    isLoading.value = true
  }

  const stopLoading = () => {
    isLoading.value = false
  }

  return {
    isLoading,
    startLoading,
    stopLoading,
  }
}
