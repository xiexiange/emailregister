# emailregister

This project is a modular email registration demo website.

The homepage lets users select an email domain suffix and click `Confirm`.
Backend registration logic is routed by domain, and each domain flow is implemented as an isolated adapter module.

## Start

```bash
npm.cmd start
```

Open:

```text
http://localhost:3000
```

## Architecture

- `public/`: Frontend page and interaction.
- `src/server.js`: HTTP server and unified API endpoints.
- `src/config/domains.js`: Domain-to-adapter mapping config.
- `src/services/domainRegistry.js`: Adapter factory registry.
- `src/services/domains/`: One independent module per provider.

## Built-in providers

- `mailslurp.com` -> `MailSlurp` adapter
- `mockmail.dev` -> demo adapter
- `example-api.com` -> template adapter for your own authorized service

## MailSlurp integration

This project uses MailSlurp official REST endpoint:

- `POST /inboxes/withOptions`

Configured in adapter:

- file: `src/services/domains/mailslurp.js`
- runtime mode by env var `MAILSLURP_CREATE_MODE`

Supported modes:

- `address`: request a specific address like `randomPrefix@mailslurp.com`
- `domainId`: create inbox on your verified custom domain by `domainId`
- `pool`: let MailSlurp choose from its domain pool
- optional fallback: `MAILSLURP_FALLBACK_TO_POOL=true` retries with domain pool when `address` mode fails

## Environment variables

Copy `.env.example` to `.env`, then replace mock values:

```env
PORT=3000
OFFICIAL_API_EXAMPLE_URL=
MAILSLURP_API_KEY=your_real_api_key
MAILSLURP_BASE_URL=https://api.mailslurp.com
MAILSLURP_CREATE_MODE=address
MAILSLURP_DOMAIN_ID=your_verified_domain_id
MAILSLURP_INBOX_TYPE=HTTP_INBOX
MAILSLURP_EXPIRES_IN=3600000
MAILSLURP_FALLBACK_TO_POOL=true
```

`src/server.js` auto-loads `.env` at startup.

## Notes

- MailSlurp mailbox access is API-key based. The `password` field shown by this demo is a generated placeholder for your UI contract.
- If you need real mailbox protocol credentials (IMAP/SMTP), add a second API call after inbox creation to fetch protocol access details.
