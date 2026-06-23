import {
  auth,
  db,
  firebaseReady,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  reload,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  doc,
  setDoc,
  serverTimestamp,
  mensagemErroFirebase,
  usuarioPrecisaVerificarEmail
} from "./firebase.js?v=6";
import { emailParaChaveSegura } from "./email-validacao.js";

const email = document.getElementById("email");
const senha = document.getElementById("senha");
const botao = document.getElementById("btnLogin");
const botaoGoogle = document.getElementById("btnGoogle");
const alternarSenha = document.getElementById("toggleSenha");
const mensagem = document.getElementById("mensagem");
let loginEmAndamento = false;
const errosComFallbackRedirect = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment"
]);

function mostrarMensagem(texto, tipo = "erro") {
  mensagem.textContent = texto;
  mensagem.className = tipo === "sucesso" ? "mensagem sucesso" : "mensagem erro";
}

function alternarBotao(botaoAtual, carregando, textoCarregando, textoPadrao) {
  if (!botaoAtual) return;
  if (!botaoAtual.dataset.htmlPadrao) {
    botaoAtual.dataset.htmlPadrao = botaoAtual.innerHTML;
  }

  botaoAtual.disabled = carregando;
  if (carregando) {
    botaoAtual.textContent = textoCarregando;
  } else {
    botaoAtual.innerHTML = botaoAtual.dataset.htmlPadrao || textoPadrao;
  }
}

function redirecionarAposLogin() {
  window.location.href = "index.html";
}

function criarProviderGoogle() {
  const provider = new GoogleAuthProvider();
  provider.addScope("profile");
  provider.addScope("email");
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

function mensagemErroAutenticacao(erro) {
  if (erro?.code === "auth/unauthorized-domain") {
    const host = window.location.host || "domínio atual";
    return `${mensagemErroFirebase(erro)} Adicione "${host}" em Authentication > Settings > Authorized domains no Firebase Console.`;
  }

  return mensagemErroFirebase(erro);
}

function separarNomeCompleto(valor = "") {
  const partes = String(valor || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  return {
    nome: partes.join(" ") || "Usuário",
    primeiroNome: partes[0] || "Usuário",
    sobrenome: partes.slice(1).join(" ")
  };
}

async function salvarPerfilBasico(usuario) {
  if (!usuario) return;

  try {
    const provedor = usuario.providerData?.[0]?.providerId || "password";
    const emailUsuario = (usuario.email || "").trim().toLowerCase();
    const nomeSeparado = separarNomeCompleto(usuario.displayName || emailUsuario || "Usuário");

    await setDoc(doc(db, "usuarios", usuario.uid), {
      uid: usuario.uid,
      nome: nomeSeparado.nome,
      primeiroNome: nomeSeparado.primeiroNome,
      sobrenome: nomeSeparado.sobrenome,
      email: emailUsuario,
      fotoURL: usuario.photoURL || "",
      provedor,
      emailVerificado: provedor !== "password" || Boolean(usuario.emailVerified),
      ultimoLoginEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    if (emailUsuario) {
      const chaveEmail = await emailParaChaveSegura(emailUsuario);

      await setDoc(doc(db, "emailsCadastrados", chaveEmail), {
        uid: usuario.uid,
        email: emailUsuario,
        metodoSenha: provedor === "password",
        metodoGoogle: provedor === "google.com",
        emailVerificado: provedor !== "password" || Boolean(usuario.emailVerified),
        ultimoLoginEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      }, { merge: true });
    }
  } catch (erro) {
    console.warn("Login concluído, mas não foi possível salvar o perfil no Firestore.", erro);
  }
}

function configuracaoVerificacaoEmail() {
  return {
    url: `${window.location.origin}/login.html?emailVerificado=1`,
    handleCodeInApp: false
  };
}

async function enviarVerificacaoEmail(usuario) {
  await sendEmailVerification(usuario, configuracaoVerificacaoEmail());
}

async function bloquearEmailNaoVerificado(usuario) {
  if (!usuario) return false;

  try {
    await reload(usuario);
  } catch (erro) {
    console.warn("Não foi possível atualizar o estado de verificação do e-mail.", erro);
  }

  if (!usuarioPrecisaVerificarEmail(usuario)) {
    return false;
  }

  let reenviado = false;

  try {
    await enviarVerificacaoEmail(usuario);
    reenviado = true;
  } catch (erro) {
    console.warn("Não foi possível reenviar o e-mail de verificação automaticamente.", erro);
  }

  try {
    await setDoc(doc(db, "usuarios", usuario.uid), {
      uid: usuario.uid,
      email: usuario.email || "",
      emailVerificado: false,
      atualizadoEm: serverTimestamp()
    }, { merge: true });
  } catch (erro) {
    console.warn("Não foi possível atualizar o status de verificação no Firestore.", erro);
  }

  await signOut(auth);
  const texto = reenviado
    ? "Confirme seu e-mail antes de entrar. Enviamos um novo link de verificação para sua caixa de entrada."
    : "Confirme seu e-mail antes de entrar. Não foi possível reenviar o link agora; tente novamente em alguns minutos.";
  mostrarMensagem(texto, "erro");
  return true;
}

function mostrarMensagemCadastro() {
  const parametros = new URLSearchParams(window.location.search);
  const statusCadastro = parametros.get("cadastro");

  if (statusCadastro === "verificar-email") {
    mostrarMensagem("Cadastro realizado. Enviamos um link de confirmação para seu e-mail. Confirme antes de entrar.", "sucesso");
    parametros.delete("cadastro");
  } else if (statusCadastro === "sucesso") {
    mostrarMensagem("Cadastro realizado com sucesso. Entre para continuar.", "sucesso");
    parametros.delete("cadastro");
  } else if (parametros.get("emailVerificado") === "1") {
    mostrarMensagem("Se a confirmação foi concluída, entre com seu e-mail e senha.", "sucesso");
    parametros.delete("emailVerificado");
  } else if (parametros.get("senha") === "alterada") {
    mostrarMensagem("Senha alterada com sucesso. Entre com sua nova senha.", "sucesso");
    parametros.delete("senha");
  }

  const consulta = parametros.toString();
  const novaUrl = `${window.location.pathname}${consulta ? `?${consulta}` : ""}`;
  window.history.replaceState({}, "", novaUrl);
}

async function processarRetornoGoogle() {
  if (!firebaseReady) return;

  try {
    const resultado = await getRedirectResult(auth);
    if (resultado?.user) {
      loginEmAndamento = true;
      await salvarPerfilBasico(resultado.user);
      mostrarMensagem("Login com Google realizado com sucesso.", "sucesso");
      redirecionarAposLogin();
    }
  } catch (erro) {
    loginEmAndamento = false;
    mostrarMensagem(mensagemErroAutenticacao(erro));
  }
}

alternarSenha?.addEventListener("click", () => {
  const senhaVisivel = senha.type === "text";
  senha.type = senhaVisivel ? "password" : "text";
  alternarSenha.setAttribute("aria-label", senhaVisivel ? "Mostrar senha" : "Ocultar senha");
  alternarSenha.classList.toggle("senha-visivel", !senhaVisivel);
});

mostrarMensagemCadastro();
await processarRetornoGoogle();

if (firebaseReady) {
  onAuthStateChanged(auth, async (usuario) => {
    if (usuario && !loginEmAndamento) {
      if (await bloquearEmailNaoVerificado(usuario)) {
        loginEmAndamento = false;
        return;
      }

      redirecionarAposLogin();
    }
  });
}

botao?.addEventListener("click", async () => {
  if (!firebaseReady) {
    mostrarMensagem("Firebase não configurado. Publique no Firebase Hosting ou preencha js/firebase.js.");
    return;
  }

  const valorEmail = email.value.trim();
  const valorSenha = senha.value.trim();

  if (!valorEmail || !valorSenha) {
    mostrarMensagem("Preencha e-mail e senha para entrar.");
    return;
  }

  loginEmAndamento = true;
  alternarBotao(botao, true, "Entrando...", "Entrar");

  try {
    const credencial = await signInWithEmailAndPassword(auth, valorEmail, valorSenha);
    if (await bloquearEmailNaoVerificado(credencial.user)) {
      loginEmAndamento = false;
      return;
    }

    await salvarPerfilBasico(credencial.user);
    mostrarMensagem("Login realizado com sucesso.", "sucesso");
    redirecionarAposLogin();
  } catch (erro) {
    loginEmAndamento = false;
    mostrarMensagem(mensagemErroAutenticacao(erro));
  } finally {
    alternarBotao(botao, false, "Entrando...", "Entrar");
  }
});

botaoGoogle?.addEventListener("click", async () => {
  if (!firebaseReady) {
    mostrarMensagem("Firebase não configurado. Publique no Firebase Hosting ou preencha js/firebase.js.");
    return;
  }

  loginEmAndamento = true;
  alternarBotao(botaoGoogle, true, "Conectando...", "Entrar com Google");

  try {
    const credencial = await signInWithPopup(auth, criarProviderGoogle());
    await salvarPerfilBasico(credencial.user);
    mostrarMensagem("Login com Google realizado com sucesso.", "sucesso");
    redirecionarAposLogin();
  } catch (erro) {
    if (errosComFallbackRedirect.has(erro?.code)) {
      mostrarMensagem("Abrindo login do Google em uma nova etapa...", "sucesso");
      await signInWithRedirect(auth, criarProviderGoogle());
      return;
    }

    loginEmAndamento = false;
    mostrarMensagem(mensagemErroAutenticacao(erro));
  } finally {
    alternarBotao(botaoGoogle, false, "Conectando...", "Entrar com Google");
  }
});
