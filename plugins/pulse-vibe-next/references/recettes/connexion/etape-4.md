### 4. Le client React et la route de better-auth

Le client tourne dans le navigateur : il reste dans `src/lib/`, hors de `src/adapters/` (réservé au serveur).

<!-- fichier: src/lib/auth-client.ts -->
```ts
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

/** Lecture de la session dans un composant client (authClient.useSession()). Les écritures passent par les actions. */
export const authClient = createAuthClient();
```

<!-- fichier: app/api/auth/[...all]/route.ts -->
```ts
// app/api/auth/[...all]/route.ts
import { getAuth } from "@src/adapters/auth/auth.adapter";
import { toNextJsHandler } from "better-auth/next-js";

export async function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
```

