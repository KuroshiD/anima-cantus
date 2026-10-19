# Anima Cantus

Monorepo da plataforma: site institucional, área do casal e painel da equipe. As decisões da versão gratuita estão em [docs/decisoes.md](docs/decisoes.md).

## Subir o ambiente

Os arquivos `.env.*` de desenvolvimento já podem estar na pasta. Se não estiverem, copie cada `.env.*.example` removendo o sufixo `.example`, e o `.env.example` para `.env`.

```bash
docker compose up -d --build
docker compose run --rm --entrypoint npx migrate prisma db seed
```

O build local do Next não gera a imagem standalone: no Windows, em pasta sincronizada, a cópia com links simbólicos é recusada. A imagem Docker liga isso com `STANDALONE=1`.

O site fica em http://localhost. O Mailpit fica em http://127.0.0.1:8025. As URLs pré-assinadas usam http://storage.localhost (os navegadores resolvem `*.localhost` para a própria máquina).

O proxy aplica CORS às URLs de armazenamento para as origens localhost. Em produção, atualize a lista `storage_cors_origin` em `nginx/default.conf` para corresponder às origens configuradas em `APP_ORIGINS`.

Contas criadas pelo seed:

- Casal: `marina.rafael@animacantus.local` / `Casal@12345`
- Outro casal, com repertório em atraso: `exemplo@animacantus.local` / `Casal@12345`
- Jornada inteira concluída: `casal.concluido@animacantus.local` / `CasalCompleto@12345`
- Equipe: `admin@animacantus.local` / `Admin@12345`

Para criar ou reaplicar a conta de jornada concluída depois do seed principal:

```bash
docker compose exec api pnpm --filter @anima/api prisma:seed:completed
```

Para demonstrar sem o Mailpit e sem o certificado, use só o arquivo principal: `docker compose -f docker-compose.yml up -d`. O profile `https` sobe o certbot; o profile `scan` sobe o ClamAV.

## Desenvolvimento sem Compose

O front em `next dev` encaminha `/api` quando `API_PROXY_URL` aponta para a API, e o SSR usa `INTERNAL_API_URL`. Postgres, Redis e MinIO continuam necessários.

```bash
corepack pnpm install
corepack pnpm --filter @anima/shared build
corepack pnpm test
```
