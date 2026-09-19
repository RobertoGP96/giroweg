# GiroWeg

Registro de kilometraje fiable para vehículos de todo tipo: motos, autos,
camionetas, furgonetas, camiones, bicicletas y maquinaria. Cada lectura del
odómetro queda en un historial auditable, rápido de capturar y disponible sin
conexión; los viajes con GPS, los gastos y el mantenimiento cuelgan de ese
historial.

## Stack

| Capa | Tecnología |
| --- | --- |
| App (móvil-first) | Next.js 16 · React 19 · HeroUI v3 · Tailwind CSS 4 · lucide-react · i18next · zustand |
| Dominio compartido | `packages/shared`: tokens de diseño, reglas puras con tests (vitest) y esquemas zod |
| Datos | `packages/db`: Drizzle ORM sobre Neon (Lakebase Postgres 18) con migraciones SQL y RLS |
| Backend | Neon: Postgres, Neon Auth (Better Auth), Data API y Object Storage (bucket `vehicles`) |
| Monorepo | pnpm workspaces |

## Estructura

```
apps/web/           app Next.js (App Router). Rutas: onboarding, login, vehicles,
                    home, history, expenses, profile, shift/start|trip|end,
                    history/[tripId], maintenance, api/health
  src/features/     auth, vehicles, readings, trips, expenses, maintenance, sync…
                    (pantallas → hooks → repository)
  src/ui/           sistema de diseño (botones, tarjetas, cifras, estados)
  src/db/           almacén local en memoria con outbox (fuente de verdad de la UI)
packages/shared/    tokens.ts · domain/ (reglas) · schemas/ (zod)
packages/db/        src/schema (tablas + políticas RLS) · migrations/ · createDb()
neon.ts             servicios de Neon por rama
CLAUDE.md           reglas del proyecto (dominio, diseño, convenciones)
```

## Reglas de dominio

1. Las lecturas son de solo inserción: se anulan con motivo, nunca se editan ni
   se borran.
2. Una lectura no puede ser menor que la anterior válida ni mayor que la
   siguiente; la única excepción es un cambio de odómetro explícito.
3. La unidad de un vehículo (`km`, `mi`, `h`) es inmutable desde su primera
   lectura.
4. El kilometraje actual se deriva de las lecturas, no se guarda.
5. Ids UUID v7 generados en el cliente; fechas en UTC.
6. El valor del OCR es una sugerencia que el usuario confirma.

Estas reglas viven en `packages/shared/domain` (funciones puras con tests) y
se repiten en Postgres con triggers (`packages/db/migrations/0002_triggers.sql`).

## Puesta en marcha

Requisitos: Node 22+, pnpm 11, cuenta de Neon con el CLI autenticado
(`npx neon auth`).

```bash
pnpm install
pnpm exec neon link      # enlaza el proyecto de Neon y la rama
pnpm db:deploy           # aplica neon.ts (Auth, Data API, bucket)
pnpm db:env              # escribe apps/web/.env.local con las variables de la rama
pnpm db:migrate          # aplica las migraciones de Drizzle
pnpm web                 # http://localhost:3000
```

Con `?state=empty|error|loading` en `/history` se fuerzan los estados de
pantalla para revisión de diseño. `GET /api/health` confirma la conexión con
Neon y las migraciones aplicadas.

## Comandos

```bash
pnpm typecheck                        # tsc en todo el monorepo
pnpm lint
pnpm test                             # vitest (packages/shared)
pnpm web:build                        # next build
pnpm db:generate                      # migración desde el esquema Drizzle
pnpm db:migrate
pnpm db:studio
pnpm db:branch dev-<feature>          # rama de Neon por feature
pnpm --filter @giroweg/db verify      # prueba las reglas contra la base (rollback)
```

Flujo de esquema: editar `packages/db/src/schema` → `pnpm db:generate` →
revisar el SQL → `pnpm db:migrate`. Funciones, triggers y grants van en
migraciones personalizadas (`generate:custom`).

## Seguridad

- RLS en todas las tablas con políticas por membresía de organización
  (`is_org_member`, `is_org_admin` sobre `auth.user_id()` del JWT de Neon Auth).
- El cliente nunca recibe `DATABASE_URL` ni credenciales del bucket: solo el
  servidor habla con Neon.
- Secretos en `.env.local` (ignorado por git); `.env.example` lista las
  variables.

## Diseño

Tema oscuro por defecto y claro de alto contraste; Space Grotesk para cifras y
títulos (números tabulares), Inter para texto; radio 16, objetivos táctiles de
56 px, acción principal en el tercio inferior. Los tokens están en
`packages/shared/src/tokens.ts` y se inyectan como variables CSS; ningún
componente escribe colores ni tamaños literales.

## Estado

- [x] Diseño móvil materializado (19 pantallas, ambos temas)
- [x] Reglas de dominio con tests y en Postgres
- [x] Esquema Drizzle, migraciones y RLS en Neon
- [ ] Neon Auth en la app (login, JWT para RLS)
- [ ] Motor de sincronización del outbox y subida de fotos al bucket
- [ ] Persistencia local en IndexedDB / app Expo
