# CookWhat

CookWhat is a Next.js 14 meal-planning application with a TypeScript/Express REST API, Prisma, and PostgreSQL. NextAuth credentials remain the sign-in system. The browser receives only a short-lived API token; database credentials and the token-signing secret stay on the server.

The PostgreSQL service is not deployed or connected until you configure a Supabase project and the environment variables below. Existing local SQLite data is not copied automatically.

## Supabase setup

1. Create a Supabase project and save its database password securely.
2. In **Project Settings → Database**, copy the connection details:
   - `DATABASE_URL`: use the pooler connection string in transaction mode (port `6543`), with `pgbouncer=true&connection_limit=1`.
   - `DIRECT_URL`: use the direct database connection (port `5432`) for Prisma migrations. If your network does not support IPv6, use Supabase's session pooler connection instead.
3. Copy `.env.example` to `.env` and replace the placeholders. Do not commit `.env`, send database passwords in chat, or use a privileged database key in browser variables.
4. Set `NEXTAUTH_SECRET` and `API_AUTH_SECRET` to separate strong random values. Use the same `API_AUTH_SECRET` for the web app and API service.
5. Set `NEXT_PUBLIC_API_URL` to the API's origin and `CORS_ORIGIN` to the exact web-app origin. Comma-separated origins are supported.
6. Generate the Prisma client and apply migrations:

   ```powershell
   npm run db:generate
   npm run db:migrate:deploy
   npm run db:seed
   ```

   For local schema development, use `npm run db:migrate:dev -- --name <migration-name>`. Do not use `prisma db push` against production.

The seed script upserts catalog categories and inserts starter recipes only when their stable IDs are absent. It does not delete or overwrite existing records.

## Local development

```powershell
npm install
Copy-Item .env.example .env
# Edit .env with the Supabase connection strings and secrets.
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
```

Run the web app and API in separate terminals:

```powershell
npm run dev
npm run api:dev
```

The web app runs at `http://localhost:3000`; the API defaults to `http://localhost:4000`. For production, build and run the Next.js app and Express API as separate services. `npm run api:build` performs TypeScript checking; `npm run api:start` starts the API entry point.

## Environment variables

| Variable | Used by | Description |
| --- | --- | --- |
| `DATABASE_URL` | Web and API | PostgreSQL pooler URL for normal queries. |
| `DIRECT_URL` | Prisma CLI | Direct/session PostgreSQL URL used for migrations. |
| `NEXTAUTH_SECRET` | Web | NextAuth session signing secret. |
| `NEXTAUTH_URL` | Web | Public origin of the Next.js application. |
| `API_AUTH_SECRET` | Web and API | Shared secret for 5-minute, audience/issuer-scoped API tokens. Keep server-side. |
| `NEXT_PUBLIC_API_URL` | Browser | Public origin of the Express API; contains no credentials. |
| `CORS_ORIGIN` | API | Allowed web origin(s), comma-separated. |
| `PORT` | API host | Express listen port; defaults to `4000`. |

## API

Authenticated endpoints require `Authorization: Bearer <short-lived-token>`. The browser obtains this token from the Next.js `/api/backend-token` route after signing in. User-owned records are always queried with the verified token subject.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Database connectivity health check. |
| `GET`, `POST` | `/api/inventory` | List or add the signed-in user's inventory. |
| `GET`, `PATCH`, `DELETE` | `/api/inventory/:id` | Read or change an owned inventory item. |
| `GET` | `/api/products/barcode/:code` | Public Open Food Facts lookup; 404 means no product match. |
| `POST` | `/api/products` | Save confirmed product details. |
| `GET`, `POST` | `/api/equipment` | List or add the user's equipment. |
| `PATCH`, `DELETE` | `/api/equipment/:id` | Change or remove owned equipment. |
| `GET`, `POST` | `/api/shopping-list` | List or add shopping-list items. |
| `PATCH`, `DELETE` | `/api/shopping-list/:id` | Change or remove an owned shopping-list item. |
| `GET`, `PUT` | `/api/preferences` | Read or replace dietary preferences and settings. |
| `GET` | `/api/recipes` | List public catalog recipes and, when authenticated, the user's own. |
| `GET` | `/api/recipes/:id` | Read an available recipe. |
| `POST` | `/api/recipes` | Create a recipe for the signed-in user. |
| `GET` | `/api/recipes/recommendations?mode=ready` | Inventory-aware recommendations (`ready`, `almost`, `soon`, `healthy`); authenticated. |

Example inventory request:

```http
POST /api/inventory
Authorization: Bearer <short-lived-token>
Content-Type: application/json
```

```json
{
  "name": "Jasmine rice",
  "category": "Pantry",
  "unit": "g",
  "ownedQuantity": 1000,
  "remainingQuantity": 650
}
```

Success responses use `{ "data": ... }`; errors use `{ "error": { "message": "..." } }`. Invalid requests return `400`, unauthenticated requests `401`, missing records `404`, and duplicate records `409`.

## Open Food Facts

Barcode lookups are made server-side against the Open Food Facts API. Results are suggestions: review or correct product details before saving them. An unknown barcode is distinct from an upstream/network failure. Product data is provided under Open Food Facts' applicable open-data license and reuse conditions; attribute Open Food Facts when displaying its data and follow the current API usage guidance at [openfoodfacts.org](https://world.openfoodfacts.org/). The client currently issues bounded requests and a descriptive User-Agent; do not build bulk lookup jobs on this endpoint.

Camera scanning requires HTTPS (or localhost) and camera permission. Manual barcode entry is available as a fallback.

## Deployment notes and current limitations

- Deploy the Next.js web app and Express API separately; set `NEXT_PUBLIC_API_URL` to the deployed API origin and allow the web origin in `CORS_ORIGIN`.
- Configure the same `API_AUTH_SECRET`, plus `DATABASE_URL` and `DIRECT_URL`, only in server-side deployment settings. Keep `NEXTAUTH_SECRET` private as well.
- Use HTTPS, restrict CORS to known origins, and configure database network access/pooling in Supabase and the hosting dashboard.
- Prisma access is server-side and scoped through Express authentication. Supabase Row Level Security policies are not configured because the application does not use the Supabase Data API directly. Do not expose database access from the browser.
- SQLite data from an earlier local setup needs a separately reviewed export/import process; applying a PostgreSQL migration does not transfer that data.
- Database/API migration and frontend wiring must be verified against a configured PostgreSQL project before claiming live persistence. Camera hardware, deployed CORS, and cross-user isolation should also be tested in the target environment.

## Checks

```powershell
npm run lint
npm test
npm run test:e2e
npm run build
npm run api:build
```
