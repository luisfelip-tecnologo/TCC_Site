import {
  auth,
  firebaseReady,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  mensagemErroFirebase
} from "./firebase.js?v=6";

const parametros = new URLSearchParams(window.location.search);
const modo = parametros.get("mode");
const codigo = parametros.get("oobCode");
const continuarUrl = parametros.get("continueUrl");

const formulario = document.getElementById("formRedefinir");
const novaSenha = document.getElementById("novaSenha");
const confirmarSenha = document.getElementById("confirmarSenha");
const botaoSalvar = document.getElementById("btnSalvarSenha");
const mensagem = document.getElementById("mensagem");
const emailDestino = document.getElementById("emailDestino");
const botoesSenha = document.querySelectorAll("[data-toggle-senha]");

let linkValido = false;

function mostrarMensagem(texto, tipo = "erro") {
  mensagem.textContent = texto;
  mensagem.className = tipo === "sucesso" ? "mensagem sucesso" : "mensagem erro";
}

function destinoSeguro(fallback) {
  if (!continuarUrl) {
    return fallback;
  }

  try {
    const url = new URL(continuarUrl, window.location.origin);

    if (url.origin !== window.location.origin) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch (erro) {
    return fallback;
  }
}

function redirecionarComMensagem(tipoAcao) {
  const fallback = tipoAcao === "verificacao"
    ? "login.html?emailVerificado=1"
    : "login.html?senha=alterada";

  setTimeout(() => {
    window.location.href = destinoSeguro(fallback);
  }, 1400);
}

function alterarEstadoFormulario(habilitado) {
  novaSenha.disabled = !habilitado;
  confirmarSenha.disabled = !habilitado;
  botaoSalvar.disabled = !habilitado;
  botoesSenha.forEach((botao) => {
    botao.disabled = !habilitado;
  });
}

function senhaForte(valor) {
  return valor.length >= 8 && /[A-ZÀ-Ý]/.test(valor) && /\d/.test(valor);
}

function mostrarEmailDoLink(email) {
  emailDestino.textContent = `Link validado para ${email}`;
}

async function confirmarEmailDoUsuario() {
  formulario.hidden = true;
  emailDestino.textContent = "Confirmando seu e-mail...";

  try {
    await applyActionCode(auth, codigo);
    mostrarMensagem("E-mail confirmado com sucesso. Redirecionando para o login...", "sucesso");
    redirecionarComMensagem("verificacao");
  } catch (erro) {
    emailDestino.textContent = "Link expirado ou inválido.";
    mostrarMensagem(mensagemErroFirebase(erro));
  }
}

async function validarLink() {
  alterarEstadoFormulario(false);

  if (!firebaseReady) {
    emailDestino.textContent = "Firebase não configurado.";
    mostrarMensagem("Publique no Firebase Hosting ou preencha js/firebase.js.");
    return;
  }

  if (modo && !["resetPassword", "verifyEmail"].includes(modo)) {
    emailDestino.textContent = "Tipo de link inválido.";
    mostrarMensagem("Este link não é de redefinição de senha. Solicite um novo e-mail.");
    return;
  }

  if (!codigo) {
    emailDestino.textContent = "Link incompleto.";
    mostrarMensagem("Abra o link completo recebido por e-mail ou solicite uma nova recuperação.");
    return;
  }

  if (modo === "verifyEmail") {
    await confirmarEmailDoUsuario();
    return;
  }

  try {
    const emailConfirmado = await verifyPasswordResetCode(auth, codigo);
    linkValido = true;
    mostrarEmailDoLink(emailConfirmado);
    alterarEstadoFormulario(true);
    mostrarMensagem("Digite e confirme sua nova senha.", "sucesso");
    novaSenha.focus();
  } catch (erro) {
    linkValido = false;
    emailDestino.textContent = "Link expirado ou inválido.";
    mostrarMensagem(mensagemErroFirebase(erro));
  }
}

botoesSenha.forEach((botao) => {
  botao.addEventListener("click", () => {
    const alvo = document.getElementById(botao.dataset.target);
    if (!alvo) return;

    const senhaVisivel = alvo.type === "text";
    alvo.type = senhaVisivel ? "password" : "text";
    botao.setAttribute("aria-label", senhaVisivel ? "Mostrar senha" : "Ocultar senha");
    botao.classList.toggle("senha-visivel", !senhaVisivel);
  });
});

formulario?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!linkValido) {
    mostrarMensagem("Solicite um novo link antes de alterar a senha.");
    return;
  }

  const valorNovaSenha = novaSenha.value.trim();
  const valorConfirmacao = confirmarSenha.value.trim();

  if (!valorNovaSenha || !valorConfirmacao) {
    mostrarMensagem("Preencha e confirme a nova senha.");
    return;
  }

  if (!senhaForte(valorNovaSenha)) {
    mostrarMensagem("A senha precisa ter no mínimo 8 caracteres, 1 letra maiúscula e 1 número.");
    return;
  }

  if (valorNovaSenha !== valorConfirmacao) {
    mostrarMensagem("As senhas não conferem.");
    return;
  }

  botaoSalvar.disabled = true;
  botaoSalvar.textContent = "Salvando...";

  try {
    await confirmPasswordReset(auth, codigo, valorNovaSenha);
    linkValido = false;
    formulario.reset();
    alterarEstadoFormulario(false);
    mostrarMensagem("Senha alterada com sucesso. Redirecionando para o login...", "sucesso");
    redirecionarComMensagem("senha");
  } catch (erro) {
    mostrarMensagem(mensagemErroFirebase(erro));
    botaoSalvar.disabled = false;
  } finally {
    botaoSalvar.textContent = "Salvar nova senha";
  }
});

validarLink();
