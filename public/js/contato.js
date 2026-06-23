const CONTACT_API_CONFIG = {
  route: "/api/contact",
  projectId: "viva-conectado-a89ac",
  region: "southamerica-east1"
};
const ERRO_SERVICO_NAO_PUBLICADO = "O serviço de envio de contato não está publicado no Firebase Functions.";

const formulario = document.getElementById("formContato");
const campos = {
  nome: document.getElementById("contatoNome"),
  email: document.getElementById("contatoEmail"),
  assunto: document.getElementById("contatoAssunto"),
  mensagem: document.getElementById("contatoMensagem"),
  website: document.getElementById("contatoWebsite")
};
const mensagemStatus = document.getElementById("mensagemContato");
const botaoEnviar = formulario?.querySelector("button[type='submit']");
const botaoTexto = botaoEnviar?.querySelector("[data-button-text]");
const textoPadraoBotao = botaoTexto?.textContent?.trim() || "Enviar mensagem";

function mostrarMensagem(texto = "", tipo = "") {
  mensagemStatus.textContent = texto;
  mensagemStatus.className = tipo
    ? `mensagem-contato ${tipo}`
    : "mensagem-contato";
}

function atualizarBotao(texto, carregando = false) {
  if (!botaoEnviar || !botaoTexto) return;

  botaoTexto.textContent = texto;
  botaoEnviar.disabled = carregando;
  botaoEnviar.setAttribute("aria-busy", carregando ? "true" : "false");
}

function emailValido(valor = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

function obterDados() {
  return {
    nome: campos.nome?.value.trim() || "",
    email: campos.email?.value.trim() || "",
    assunto: campos.assunto?.value.trim() || "",
    mensagem: campos.mensagem?.value.trim() || "",
    website: campos.website?.value.trim() || ""
  };
}

function validarCampos(dados) {
  if (!dados.nome || !dados.email || !dados.assunto || !dados.mensagem) {
    return "Preencha todos os campos obrigatórios.";
  }

  if (!emailValido(dados.email)) {
    return "Digite um e-mail válido para recebermos seu contato.";
  }

  if (dados.mensagem.length < 10) {
    return "Escreva uma mensagem com pelo menos 10 caracteres.";
  }

  return "";
}

function focoNoPrimeiroCampoInvalido(dados) {
  if (!dados.nome) {
    campos.nome?.focus();
    return;
  }

  if (!dados.email || !emailValido(dados.email)) {
    campos.email?.focus();
    return;
  }

  if (!dados.assunto) {
    campos.assunto?.focus();
    return;
  }

  if (!dados.mensagem || dados.mensagem.length < 10) {
    campos.mensagem?.focus();
  }
}

function emAmbienteLocal() {
  return window.location.protocol === "file:"
    || ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function obterEndpointDireto() {
  return `https://${CONTACT_API_CONFIG.region}-${CONTACT_API_CONFIG.projectId}.cloudfunctions.net/enviarContato`;
}

function obterEndpointsContato() {
  const endpointDireto = obterEndpointDireto();
  const endpoints = [CONTACT_API_CONFIG.route];

  if (emAmbienteLocal() || window.location.hostname.endsWith(".web.app")) {
    endpoints.push(endpointDireto);
  }

  return endpoints;
}

async function lerMensagemErro(resposta) {
  try {
    const payload = await resposta.json();
    return payload?.message || "";
  } catch {
    return "";
  }
}

async function enviarContato(dados) {
  const endpoints = obterEndpointsContato();
  let ultimoErro = null;

  for (let indice = 0; indice < endpoints.length; indice += 1) {
    const endpoint = endpoints[indice];
    const ultimoEndpoint = indice === endpoints.length - 1;

    try {
      const resposta = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(dados)
      });

      if (resposta.status === 404 && !ultimoEndpoint) {
        ultimoErro = new Error(ERRO_SERVICO_NAO_PUBLICADO);
        continue;
      }

      if (resposta.status === 404) {
        throw new Error(ERRO_SERVICO_NAO_PUBLICADO);
      }

      if (!resposta.ok) {
        const mensagemErro = await lerMensagemErro(resposta);

        if (!ultimoEndpoint && !mensagemErro && [404, 405, 501].includes(resposta.status)) {
          ultimoErro = new Error(ERRO_SERVICO_NAO_PUBLICADO);
          continue;
        }

        throw new Error(mensagemErro || "Não foi possível enviar sua mensagem agora. Tente novamente.");
      }

      try {
        return await resposta.json();
      } catch {
        return { ok: true };
      }
    } catch (erro) {
      if (!(erro instanceof TypeError && ultimoEndpoint && ultimoErro)) {
        ultimoErro = erro;
      }
      console.warn("Falha ao chamar endpoint de contato.", {
        endpoint,
        ultimoEndpoint,
        erro
      });

      if (!ultimoEndpoint && erro instanceof TypeError) {
        continue;
      }
    }
  }

  throw ultimoErro || new Error("Não foi possível enviar sua mensagem agora. Tente novamente.");
}

formulario?.addEventListener("submit", async (event) => {
  event.preventDefault();
  mostrarMensagem();

  const dados = obterDados();
  const erroValidacao = validarCampos(dados);

  if (erroValidacao) {
    mostrarMensagem(erroValidacao, "erro");
    focoNoPrimeiroCampoInvalido(dados);
    return;
  }

  atualizarBotao("Enviando...", true);

  try {
    const resposta = await enviarContato(dados);
    mostrarMensagem(resposta?.message || "Mensagem enviada com sucesso.", "sucesso");
    formulario.reset();
    campos.nome?.focus();
  } catch (erro) {
    console.warn("Erro no envio do contato.", erro);
    mostrarMensagem(
      erro?.message || "Não foi possível enviar sua mensagem agora. Tente novamente.",
      "erro"
    );
  } finally {
    atualizarBotao(textoPadraoBotao, false);
  }
});
