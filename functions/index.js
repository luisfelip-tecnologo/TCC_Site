const logger = require("firebase-functions/logger");
const functionsV1 = require("firebase-functions/v1");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const SMTP_HOST = defineSecret("SMTP_HOST");
const SMTP_PORT = defineSecret("SMTP_PORT");
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");

const DESTINATARIO_CONTATO = "vivaconctado@gmail.com";
const ASSUNTO_PREFIXO = "[Viva Conectado]";
let transporterPromise = null;

function normalizarTexto(valor = "", limite = 0) {
  const texto = String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();

  return limite ? texto.slice(0, limite) : texto;
}

function normalizarMensagem(valor = "", limite = 0) {
  const texto = String(valor ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();

  return limite ? texto.slice(0, limite) : texto;
}

function emailValido(valor = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

function validarDados(dados) {
  if (!dados.nome || !dados.email || !dados.assunto || !dados.mensagem) {
    return "Preencha todos os campos obrigatorios.";
  }

  if (!emailValido(dados.email)) {
    return "Digite um e-mail valido para recebermos seu contato.";
  }

  if (dados.mensagem.length < 10) {
    return "Escreva uma mensagem com pelo menos 10 caracteres.";
  }

  return "";
}

function escapeHtml(valor = "") {
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function obterTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      const host = SMTP_HOST.value();
      const port = Number(SMTP_PORT.value() || 465);
      const user = SMTP_USER.value();
      const pass = SMTP_PASS.value();

      if (!host || !Number.isFinite(port) || !user || !pass) {
        throw new Error("SMTP_NAO_CONFIGURADO");
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000
      });

      await transporter.verify();
      return transporter;
    })().catch((erro) => {
      transporterPromise = null;
      throw erro;
    });
  }

  return transporterPromise;
}

function montarEmailTexto(dados, origem) {
  return [
    "Novo contato recebido pelo site Viva Conectado.",
    "",
    `Nome: ${dados.nome}`,
    `E-mail: ${dados.email}`,
    `Assunto: ${dados.assunto}`,
    `Origem: ${origem}`,
    "",
    "Mensagem:",
    dados.mensagem
  ].join("\n");
}

function montarEmailHtml(dados, origem) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 16px">Novo contato recebido pelo Viva Conectado</h2>
      <p style="margin:0 0 8px"><strong>Nome:</strong> ${escapeHtml(dados.nome)}</p>
      <p style="margin:0 0 8px"><strong>E-mail:</strong> ${escapeHtml(dados.email)}</p>
      <p style="margin:0 0 8px"><strong>Assunto:</strong> ${escapeHtml(dados.assunto)}</p>
      <p style="margin:0 0 16px"><strong>Origem:</strong> ${escapeHtml(origem)}</p>
      <div style="padding:16px;border-radius:12px;background:#f8fafc;border:1px solid #dbeafe;white-space:pre-wrap">
        ${escapeHtml(dados.mensagem)}
      </div>
    </div>
  `;
}

function responderJson(res, status, payload) {
  res
    .status(status)
    .set("Cache-Control", "no-store")
    .json(payload);
}

async function excluirSnapshotAdmin(snapshot) {
  if (!snapshot || snapshot.empty) return;

  let batch = firestore.batch();
  let operacoes = 0;
  const commits = [];

  snapshot.forEach((docSnapshot) => {
    batch.delete(docSnapshot.ref);
    operacoes += 1;

    if (operacoes === 450) {
      commits.push(batch.commit());
      batch = firestore.batch();
      operacoes = 0;
    }
  });

  if (operacoes) {
    commits.push(batch.commit());
  }

  await Promise.all(commits);
}

async function excluirColecaoUsuario(uid, nomeColecao) {
  const snapshot = await firestore
    .collection("usuarios")
    .doc(uid)
    .collection(nomeColecao)
    .get();

  await excluirSnapshotAdmin(snapshot);
}

async function excluirIndicesEmailUsuario(uid) {
  const snapshot = await firestore
    .collection("emailsCadastrados")
    .where("uid", "==", uid)
    .get();

  await excluirSnapshotAdmin(snapshot);
}

async function excluirDadosUsuario(uid, opcoes = {}) {
  await Promise.all([
    excluirColecaoUsuario(uid, "pontuacoes"),
    excluirColecaoUsuario(uid, "aprendizado"),
    excluirIndicesEmailUsuario(uid)
  ]);

  const batch = firestore.batch();
  batch.delete(firestore.collection("ranking").doc(uid));

  if (opcoes.excluirPerfil !== false) {
    batch.delete(firestore.collection("usuarios").doc(uid));
  }

  await batch.commit();
}

exports.limparDadosUsuarioExcluido = functionsV1
  .region("southamerica-east1")
  .auth
  .user()
  .onDelete(async (user) => {
    const uid = user?.uid;

    if (!uid) {
      logger.warn("Evento de exclusao de usuario sem UID.");
      return;
    }

    await excluirDadosUsuario(uid);
    logger.info("Dados do usuario excluido foram removidos.", { uid });
  });

exports.limparDadosPerfilExcluido = functionsV1
  .region("southamerica-east1")
  .firestore
  .document("usuarios/{uid}")
  .onDelete(async (_snapshot, context) => {
    const uid = context.params?.uid;

    if (!uid) {
      logger.warn("Evento de exclusao de perfil sem UID.");
      return;
    }

    await excluirDadosUsuario(uid, { excluirPerfil: false });
    logger.info("Referencias do perfil excluido foram removidas.", { uid });
  });

exports.enviarContato = onRequest(
  {
    region: "southamerica-east1",
    cors: true,
    invoker: "public",
    timeoutSeconds: 30,
    secrets: [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS]
  },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      responderJson(res, 405, {
        ok: false,
        message: "Metodo nao permitido."
      });
      return;
    }

    const corpo = typeof req.body === "object" && req.body ? req.body : {};
    const dados = {
      nome: normalizarTexto(corpo.nome, 80),
      email: normalizarTexto(corpo.email, 160).toLowerCase(),
      assunto: normalizarTexto(corpo.assunto, 120),
      mensagem: normalizarMensagem(corpo.mensagem, 5000),
      website: normalizarTexto(corpo.website, 200)
    };

    if (dados.website) {
      responderJson(res, 400, {
        ok: false,
        message: "Nao foi possivel enviar sua mensagem."
      });
      return;
    }

    const erroValidacao = validarDados(dados);
    if (erroValidacao) {
      responderJson(res, 400, {
        ok: false,
        message: erroValidacao
      });
      return;
    }

    const origem = req.get("origin") || req.get("referer") || "origem nao identificada";

    try {
      const transporter = await obterTransporter();

      await transporter.sendMail({
        from: {
          name: "Viva Conectado",
          address: SMTP_USER.value()
        },
        to: DESTINATARIO_CONTATO,
        replyTo: {
          name: dados.nome,
          address: dados.email
        },
        subject: `${ASSUNTO_PREFIXO} ${dados.assunto}`,
        text: montarEmailTexto(dados, origem),
        html: montarEmailHtml(dados, origem)
      });

      logger.info("Contato enviado com sucesso", {
        remetente: dados.email,
        assunto: dados.assunto
      });

      responderJson(res, 200, {
        ok: true,
        message: "Mensagem enviada com sucesso."
      });
    } catch (erro) {
      logger.error("Falha ao enviar contato", {
        message: erro?.message || "erro_desconhecido",
        stack: erro?.stack || ""
      });

      const mensagemErro = erro?.message === "SMTP_NAO_CONFIGURADO"
        ? "O servico de contato ainda nao foi configurado."
        : "Nao foi possivel enviar sua mensagem agora. Tente novamente em instantes.";

      responderJson(res, 500, {
        ok: false,
        message: mensagemErro
      });
    }
  }
);
