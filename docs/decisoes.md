# Decisões da versão gratuita

- A API do gov.br foi descartada porque é restrita a órgãos públicos. O casal assina fora do sistema e envia o PDF.
- O hash SHA-256 prova a integridade do arquivo, não a autenticidade da assinatura. A conferência desta versão é manual, no verificador do ITI.
- O WhatsApp fica no link `wa.me`. O envio automático do orçamento (RF05) é o e-mail para a equipe mais o botão que abre a mensagem pronta. A Cloud API entra só se o grupo decidir pagar.
- Tudo que depende de API possivelmente paga está na tabela abaixo.
- O nginx é o proxy reverso. O HTTPS entra com certbot quando houver domínio.
- A fila é BullMQ com Redis, no lugar de RabbitMQ, pela operação mais simples e pela integração com NestJS.
- A sessão fica no Redis, e não em JWT puro, para poder ser revogada.
- As datas da janela do repertório e do envio de 1 ano ficam em colunas da jornada. Um job diário de reconciliação enfileira o que ainda não foi enviado.
- O e-mail é o canal principal de notificação. O WhatsApp automático existe só como implementação que recusa o envio, para o contrato da interface ficar explícito.

## Features a discutir em grupo

| Feature | Motivo | Padrão atual (gratuito) |
|---|---|---|
| WhatsApp Cloud API | Cobrança por mensagem e templates aprovados pela Meta | wa.me manual + e-mail |
| Provedor de assinatura com API | Em geral pago | gov.br manual + upload |
| Provedor transacional de e-mail | Planos gratuitos mudam de limite; domínio próprio melhora a entrega | SMTP de conta existente (Mailpit no desenvolvimento) |
| Monitoramento SaaS | Serviço externo com limites variáveis | Logs JSON + alertas internos + Uptime Kuma opcional |
| Hospedagem em VPS | Worker e cron precisam de máquina ligada | Compose local ou máquina do grupo |
| Domínio e HTTPS público | Custo anual; necessário para Let's Encrypt e SPF/DKIM | HTTP local |
| Verificação automática PAdES/ICP-Brasil | Esforço de biblioteca ainda em aberto | Conferência manual pela equipe |

## Ajuste em relação ao Compose de referência

As imagens de `web` e `api` usam o contexto da raiz do repositório (`dockerfile: api/Dockerfile` e `web/Dockerfile`). O contexto `./api` não alcança o pacote `shared/`, que é a fonte dos schemas usados pelos dois lados.
