# `/api/auth/google` contract

## Request

- Method: `POST`
- Body:

```json
{
  "idToken": "google-id-token"
}
```

## Success response (`200`)

```json
{
  "user": {
    "id": "uuid",
    "email": "juan.dela.cruz@up.edu.ph",
    "name": "Juan Dela Cruz"
  },
  "session": {
    "expiresAt": "2026-02-28T10:00:00.000Z",
    "strategy": "httpOnlyCookie"
  }
}
```

Notes:

- Session token is stored in `Set-Cookie: takeup_session=...; HttpOnly; SameSite=Lax`.
- The frontend must not store session tokens in localStorage/sessionStorage.

## Error response

```json
{
  "error": {
    "code": "AUTH_INVALID_TOKEN",
    "message": "The Google ID token is invalid."
  }
}
```

## Standard auth error codes

- `AUTH_DOMAIN_NOT_ALLOWED`
- `AUTH_INVALID_TOKEN`
- `AUTH_TOKEN_EXPIRED`
- `AUTH_PROVIDER_MISCONFIG`
- `AUTH_UNAUTHORIZED`
- `AUTH_SESSION_INVALID`
- `AUTH_INTERNAL`
