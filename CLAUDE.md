# GiroWeg

App para registrar el kilometraje de vehículos de distintos tipos (motos, autos,
camionetas, furgonetas, camiones, bicicletas, maquinaria). El valor del producto
es un historial de lecturas fiable por vehículo: rápido de capturar, imposible de
corromper y disponible sin conexión.

## Stack

- Monorepo pnpm workspaces: `apps/mobile`, `apps/web` (fase 3), `packages/shared`.
- Móvil: Expo (React Native) + Expo Router + TypeScript estricto. Se usa
  development build, no Expo Go (hay módulos nativos).
- Backend: Neon (Lakebase Postgres 18, Neon Auth = Better Auth gestionado,
  Data API para validar JWT y exponer `auth.user_id()`, Object Storage bucket
  privado `vehicles`). Proyecto `frosty-pond-09171186`, rama `production`,
  región us-east-2. Sin servidor propio: la lógica que no puede vivir en el
  cliente va en funciones SQL / triggers o en route handlers de Next.
- ORM: Drizzle en `packages/db` (esquema TypeScript en `src/schema`, migraciones
  SQL en `migrations/` generadas con drizzle-kit; las funciones, triggers y
  grants van en migraciones `--custom`). Cliente `createDb(url, authToken?)`
  sobre `@neondatabase/serverless` (HTTP). Sin Prisma.
- Local/offline: expo-sqlite + Drizzle ORM (móvil) / LocalStore en memoria (web,
  pendiente IndexedDB). La base local es la fuente de verdad de la UI; Neon es el
  destino de sincronización.
- Datos remotos: Drizzle en servidor + TanStack Query en cliente. Estado de UI:
  Zustand.
- Formularios y validación: react-hook-form + zod. Los esquemas zod viven en
  `packages/shared` y se reutilizan en móvil y web.
- Estilos: NativeWind con los tokens de `packages/shared/tokens.ts`.
- Gráficos: victory-native. OCR del odómetro: ML Kit en el dispositivo
  (`@react-native-ml-kit/text-recognition`), nunca un servicio en la nube.
- Web (fase 3): Next.js App Router, mismo Supabase, mismos esquemas zod.
- No usar Prisma: el esquema vive en Drizzle y los tipos salen de él
  (`InferSelectModel`), sin paso de generación.

Antes de instalar o usar una librería, consulta su documentación actual con
Context7. No fijes versiones de memoria.

## Comandos

```
pnpm install
pnpm web               # next dev (apps/web) en http://localhost:3000
pnpm web:build         # next build
pnpm web:start         # next start
pnpm mobile            # expo start --dev-client (pendiente de crear)
pnpm mobile:android    # build de desarrollo Android (pendiente)
pnpm mobile:ios        # build de desarrollo iOS (pendiente)
pnpm typecheck         # tsc --noEmit en todo el monorepo
pnpm lint
pnpm test              # vitest (shared) + jest-expo (mobile, pendiente)
pnpm db:deploy         # neon deploy: aplica neon.ts (Auth, Data API, bucket) a la rama enlazada
pnpm db:env            # neon env pull → apps/web/.env.local (DATABASE_URL, NEON_AUTH_*, AWS_*)
pnpm db:generate       # drizzle-kit generate (migración desde el esquema)
pnpm db:migrate        # drizzle-kit migrate con DATABASE_URL_UNPOOLED
pnpm db:studio         # drizzle-kit studio
pnpm db:branch <name>  # neon checkout: rama de Neon por feature (dev-* con TTL 14 d)
```

Flujo de esquema: editar `packages/db/src/schema` → `pnpm db:generate` →
revisar el SQL → `pnpm db:migrate`. Para funciones/triggers/grants:
`pnpm --filter @giroweg/db generate:custom --name=<nombre>` y escribir el SQL.
Probar migraciones en una rama (`pnpm db:branch dev-<feature>`) antes de
`production`. Contexto del CLI en `.neon` (ignorado por git).

Nota de pnpm 11: la política `minimumReleaseAge` rechaza paquetes publicados
hace menos de 24 h; si `pnpm install` falla por eso, fija una versión anterior
en vez de relajar la política. Los scripts de build permitidos viven en
`pnpm-workspace.yaml` (`allowBuilds`).

Si un comando no existe todavía, créalo con ese nombre y mantén esta lista al día.
Una tarea no está terminada hasta que pasan `pnpm typecheck`, `pnpm lint` y
`pnpm test`.

## Estructura

```
apps/web/              app móvil-first en Next.js 16 (materializa el diseño
                       "GiroWeg Movil" de Claude Design) · React 19, HeroUI v3,
                       Tailwind 4, lucide-react, i18next, zustand
  app/                 rutas App Router (solo composición): (auth) onboarding,
                       login, login/verify, vehicles · (tabs) home, history,
                       expenses, profile · (flow) shift/start|trip|end,
                       history/[tripId], maintenance
  app/globals.css      mapea los tokens --gw-* a utilidades Tailwind y a los
                       tokens semánticos de HeroUI; sombras como @utility
  src/features/<x>/    auth, onboarding, vehicles, readings, trips, expenses,
                       maintenance, profile, home, sync
    components/ hooks/ screens/ repository.ts
  src/db/              LocalStore en memoria + outbox (mismo contrato que
                       tendrá SQLite/IndexedDB) y fixtures de demo (seed.ts)
  src/ui/              sistema de diseño: Button/IconButton (HeroUI), Card,
                       chips, Figure, Progress/Ring, TopBar, BottomNav, estados
  src/i18n/            i18next, textos en locales/es.json
  src/theme/           ThemeProvider (dark | light | auto) + script anti-flash
apps/mobile/           (pendiente) Expo
  app/                 rutas Expo Router (solo composición, sin lógica)
  src/features/<x>/    vehicles, readings, trips, expenses, maintenance, reports
    components/ hooks/ screens/ repository.ts
  src/db/              esquema Drizzle, migraciones locales, cliente SQLite
  src/sync/            outbox, motor de sincronización, subida de fotos
  src/ui/              componentes base del sistema de diseño
packages/shared/       (src/) tokens.ts, domain/, schemas/ con tests vitest
packages/db/           Drizzle: src/schema (tablas, enums desde shared, políticas
                       RLS por membresía), src/client.ts (createDb), migrations/
                       (0000 roles+funciones is_org_member/admin, 0001 tablas,
                       0002 triggers de reglas de dominio y create_organization)
neon.ts                servicios de Neon por rama (auth, dataApi, bucket vehicles)
  domain/              reglas puras (validación de lecturas, unidades, cálculos)
  schemas/             zod
  tokens.ts            colores, tipografía, espaciado
  database.types.ts    generado, no editar a mano
supabase/
  migrations/          SQL versionado
  seed.sql
```

Las pantallas llaman hooks; los hooks llaman al `repository` de su feature; solo
los repositorios tocan SQLite. Nada fuera de `src/sync` habla con Supabase para
escribir datos.

## Modelo de datos

- `organizations`, `memberships (user_id, org_id, role: owner|admin|member)`.
  Un usuario individual es una organización de una persona. Todo dato cuelga de
  `org_id`. Así el modo multiusuario no exige migrar nada después.
- `vehicles`: tipo (enum), nombre, marca, modelo, año, placa, foto, `unit`
  (`km|mi|h`), `initial_value`, `archived_at`.
- `readings`: `vehicle_id`, `value numeric(10,1)`, `recorded_at`, `source`
  (`manual|ocr|trip`), `photo_path`, `note`, `created_by`, `voided_at`,
  `void_reason`, `odometer_reset` (cambio de odómetro explícito: reinicia la
  secuencia y exige `note`).
- `trips`: `start_reading_id`, `end_reading_id`, distancia GPS, motivo.
- `expenses`: tipo (combustible, otro), importe, moneda, litros, `reading_id`.
- `maintenance_rules` (cada N unidades o N días) y `maintenance_events`.

## Reglas de dominio (no negociables)

1. Las lecturas son de solo inserción. No se editan ni se borran: se anulan con
   `voided_at` + `void_reason` y se crea una nueva. El historial es auditable.
2. Una lectura no puede ser menor que la última lectura válida anterior en el
   tiempo ni mayor que la siguiente. Se valida en `packages/shared/domain` y
   también con un trigger en Postgres. Excepción: cambio de odómetro, que se
   registra como evento explícito con confirmación del usuario.
3. La unidad de un vehículo es inmutable desde que tiene su primera lectura.
   Nunca se mezclan ni convierten unidades al guardar; solo al mostrar reportes.
4. El kilometraje actual de un vehículo se deriva de sus lecturas, no se guarda
   como campo editable.
5. Todos los ids son UUID v7 generados en el cliente. Todas las fechas se guardan
   en UTC; `recorded_at` es la hora del dispositivo y `synced_at` la del servidor.
6. El valor del OCR es una sugerencia: siempre se muestra en un campo editable y
   el usuario confirma antes de guardar.

## Offline y sincronización

- Toda escritura va primero a SQLite y a la tabla `outbox` en la misma
  transacción. La UI nunca espera a la red.
- El motor de sync procesa el outbox en orden, con reintentos y backoff, y hace
  upsert idempotente por id. Las lecturas no generan conflictos porque son de
  solo inserción; en `vehicles` gana el `updated_at` más reciente.
- Las fotos se comprimen (lado máximo 1600 px, JPEG 0.7), se guardan en disco y
  se suben después a un bucket privado: `{org_id}/{vehicle_id}/{reading_id}.jpg`.
- La UI muestra siempre el estado de sincronización de cada registro.

## Seguridad

- RLS activado en todas las tablas, con políticas basadas en `memberships`
  (`is_org_member(org_id)` / `is_org_admin(org_id)` comparan `auth.user_id()`
  del JWT de Neon Auth). Las políticas se declaran en el esquema Drizzle con
  `orgPolicies()` para que salgan en la misma migración que la tabla. El rol
  `authenticated` es el del usuario final; el owner de la base (sync, admin)
  omite RLS y solo se usa en servidor.
- En el cliente nunca va `DATABASE_URL` ni `AWS_*`: solo el servidor (route
  handlers) habla con Neon. La service role/owner no aparece en el repo.
- Bucket `vehicles` privado, acceso con URLs firmadas generadas en servidor.
- Secretos en `.env.local` (ignorado por git, lo escribe `pnpm db:env`);
  `.env.example` al día.
- Lecturas: `readings_append_only` bloquea borrados y ediciones (solo anular o
  adjuntar la foto una vez); `readings_validate` aplica la regla 2;
  `vehicles_unit_immutable` la regla 3. Un borrado administrativo de una
  organización requiere `SET LOCAL giroweg.allow_purge = 'on'` como owner.

## Diseño

- Tema oscuro por defecto y tema claro de alto contraste. Tokens: fondo
  `#0E1116`, superficie `#171B22`, acento `#B6F23C`, alerta `#FFB020`, texto
  `#F2F4F7`. Space Grotesk para cifras y títulos (números tabulares), Inter para
  texto. Radio 16, objetivos táctiles mínimo 56 px, acción principal en el
  tercio inferior.
- Prohibido escribir colores, tamaños o espaciados literales en componentes:
  siempre tokens.
- Toda pantalla implementa sus cuatro estados: cargando, vacío, error, sin
  conexión.
- Accesibilidad: contraste AA, `accessibilityLabel` en todo control sin texto.

## Convenciones

- Código, identificadores, commits y comentarios en inglés. Textos de interfaz en
  español mediante i18next (`es` por defecto); ninguna cadena visible escrita
  directamente en un componente.
- TypeScript estricto, sin `any` ni `as` para silenciar errores. Exportaciones
  con nombre. Componentes funcionales.
- Las reglas de `packages/shared/domain` son funciones puras con tests
  unitarios. Cada regla de dominio de este archivo tiene al menos un test.
- Migraciones SQL pequeñas y solo hacia adelante, generadas por drizzle-kit y
  revisadas antes de aplicar. Nunca editar una migración ya aplicada.

## Alcance por fases

1. MVP: auth, vehículos (alta, edición, archivo), nueva lectura con foto y OCR,
   validación, detalle con gráfico, historial con filtros, offline + sync,
   exportar CSV.
2. Viajes con GPS, combustible y gastos, mantenimiento con recordatorios, PDF.
3. Panel web: dashboard, tabla de vehículos, usuarios y permisos, reportes.

No implementes nada de una fase posterior sin que se pida. Si una tarea es
ambigua o choca con una regla de este archivo, pregunta antes de escribir código.
