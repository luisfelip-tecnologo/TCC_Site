# Configuracao do formulario de contato

O envio do formulario de contato agora usa `Firebase Functions + Nodemailer`.

## Diagnostico verificado em 30/05/2026

O front-end publicado chama `/api/contact`, mas o projeto `viva-conectado-a89ac` nao tem nenhuma Function publicada:

```bash
firebase functions:list --project viva-conectado-a89ac
```

Resultado observado: lista vazia.

Tambem foi testado um deploy seco:

```bash
firebase deploy --only functions --project viva-conectado-a89ac --non-interactive --dry-run
```

O Firebase bloqueou o deploy porque o projeto nao esta no plano Blaze. Sem Blaze, as APIs exigidas por Cloud Functions/Artifact Registry/Secret Manager nao podem ser ativadas. Portanto, o formulario nao consegue enviar e-mail real pela arquitetura atual ate que o projeto seja atualizado e os segredos SMTP sejam configurados.

## Segredos obrigatorios

Defina estes segredos no projeto Firebase:

```bash
firebase functions:secrets:set SMTP_HOST
firebase functions:secrets:set SMTP_PORT
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
```

## Exemplo com Gmail

Use os valores abaixo se quiser enviar via Gmail:

- `SMTP_HOST`: `smtp.gmail.com`
- `SMTP_PORT`: `465`
- `SMTP_USER`: `vivaconctado@gmail.com`
- `SMTP_PASS`: senha de app do Google, nao a senha normal da conta

## Destino do formulario

As mensagens recebidas pelo site sao enviadas para:

```text
vivaconctado@gmail.com
```

## Limpeza de conta e ranking

As Functions `limparDadosUsuarioExcluido` e `limparDadosPerfilExcluido` rodam quando um usuario e removido do Firebase Auth ou quando o perfil `usuarios/{uid}` e excluido. Elas removem:

- `usuarios/{uid}`
- `usuarios/{uid}/pontuacoes/*`
- `usuarios/{uid}/aprendizado/*`
- `ranking/{uid}`
- documentos de `emailsCadastrados` com o mesmo `uid`

Isso evita que uma conta excluida continue aparecendo no ranking depois que as Functions estiverem publicadas.

## Deploy

Depois de atualizar o projeto para o plano Blaze e configurar os segredos, publique:

```bash
firebase deploy --only functions,hosting --project viva-conectado-a89ac
```

Sem o deploy da Function e sem os segredos SMTP, o navegador valida o formulario, mas nao existe servico real para entregar o e-mail.

## Observacoes

- O front-end chama `/api/contact` quando o site esta no Firebase Hosting.
- Em ambiente local e no dominio `.web.app`, o script tambem tenta a URL publica da Function como fallback.
- A Function foi declarada com `invoker: "public"` para aceitar visitantes sem login depois de publicada.
- O botao do formulario agora mostra estado de envio e o sistema faz validacao no navegador e no back-end.
- Para Gmail, ative a verificacao em duas etapas na conta e gere uma senha de app em Conta Google > Seguranca > Senhas de app.
