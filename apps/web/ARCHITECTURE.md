# Frontend architecture

The current UI is a demo: login changes local React state and dashboard values are examples. There is no URL router or authentication API yet. Refreshing returns to login. Keep this behavior distinct from real sessions and server data.

- `app/` composes the application and providers; `pages/` owns page-level composition.
- `features/<name>/` owns business-specific components and data. Other features and pages import only its `index.ts` public API. Add feature-local `api`, `hooks`, types or schemas only when needed.
- `shared/` contains code reused across features. Use `shared/api/http.ts` for requests through `/api` on the HTTP gateway. Vite proxies this path to localhost:3000 in development; production hosting must route `/api` to the gateway.
- Use TanStack Query hooks in the owning feature for actual server state, with feature-scoped query keys and invalidation after relevant mutations. Keep transient UI state in React. Do not cache demo constants as server data.
- Add authentication handling to the HTTP client when the gateway defines a session contract; the current demo does not authenticate. Define API types from actual gateway contracts and add runtime validation when an existing validation library or a real boundary warrants it.

Run `npm run typecheck -w @dexatrack/web`, `npm run lint -w @dexatrack/web`, `npm run test -w @dexatrack/web`, and `npm run build -w @dexatrack/web`. Tests live next to the code they cover as `*.test.ts(x)`.
