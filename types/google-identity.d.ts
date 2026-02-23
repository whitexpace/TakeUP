type GoogleCredentialResponse = {
  credential?: string
}

type GoogleIdInitializeOptions = {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
}

type GoogleAccountsId = {
  initialize: (options: GoogleIdInitializeOptions) => void
  prompt: () => void
}

type Google = {
  accounts: {
    id: GoogleAccountsId
  }
}

interface Window {
  google?: Google
}
