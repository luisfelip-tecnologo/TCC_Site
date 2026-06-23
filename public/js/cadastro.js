import {
  auth,
  db,
  firebaseReady,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  updateProfile,
  doc,
  setDoc,
  serverTimestamp,
  mensagemErroFirebase
} from "./firebase.js?v=6";
import { emailPermitido, normalizarEmail, mensagemDominiosEmail, emailParaChaveSegura } from "./email-validacao.js";

const nome = document.getElementById("nome");
const sobrenome = document.getElementById("sobrenome");
const email = document.getElementById("email");
const senha = document.getElementById("senha");
const confirmar = document.getElementById("confirmar");
const botao = document.getElementById("btnCadastro");
const mensagem = document.getElementById("mensagem");

function mostrarMensagem(texto, tipo = "erro") {
  mensagem.textContent = texto;
  mensagem.className = tipo === "sucesso" ? "mensagem sucesso" : "mensagem erro";
}

function limparParteNome(valor = "") {
  return String(valor).trim().replace(/\s+/g, " ");
}

function primeiroNomeDoValor(valor = "") {
  return limparParteNome(valor).split(/\s+/).filter(Boolean)[0] || "";
}

function senhaForte(valor) {
  return valor.length >= 8 && /[A-ZÀ-Ý]/.test(valor) && /\d/.test(valor);
}

function configuracaoVerificacaoEmail() {
  return {
    url: `${window.location.origin}/login.html?emailVerificado=1`,
    handleCodeInApp: false
  };
}

async function salvarIndiceEmail(usuario, valorEmail) {
  const chaveEmail = await emailParaChaveSegura(valorEmail);

  if (!chaveEmail) {
    return;
  }

  await setDoc(doc(db, "emailsCadastrados", chaveEmail), {
    uid: usuario.uid,
    email: valorEmail,
    metodoSenha: true,
    metodoGoogle: false,
    emailVerificado: false,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  }, { merge: true });
}

botao?.addEventListener("click", async () => {
  const valorNome = limparParteNome(nome.value);
  const valorSobrenome = limparParteNome(sobrenome.value);
  const valorNomeCompleto = `${valorNome} ${valorSobrenome}`.trim();
  const valorEmail = normalizarEmail(email.value);
  const valorSenha = senha.value.trim();
  const valorConfirmar = confirmar.value.trim();

  if (!firebaseReady) {
    mostrarMensagem("Firebase não configurado. Publique no Firebase Hosting ou preencha js/firebase.js.");
    return;
  }

  if (!valorNome || !valorSobrenome || !valorEmail || !valorSenha || !valorConfirmar) {
    mostrarMensagem("Preencha todos os campos.");
    return;
  }

  if (!emailPermitido(valorEmail)) {
    mostrarMensagem(mensagemDominiosEmail());
    return;
  }

  if (!senhaForte(valorSenha)) {
    mostrarMensagem("A senha precisa ter no mínimo 8 caracteres, 1 letra maiúscula e 1 número.");
    return;
  }

  if (valorSenha !== valorConfirmar) {
    mostrarMensagem("As senhas não conferem.");
    return;
  }

  botao.disabled = true;
  botao.textContent = "Criando...";

  try {
    const credencial = await createUserWithEmailAndPassword(auth, valorEmail, valorSenha);
    let avisoPerfil = "";

    try {
      await updateProfile(credencial.user, { displayName: valorNomeCompleto });
      await setDoc(doc(db, "usuarios", credencial.user.uid), {
        uid: credencial.user.uid,
        nome: valorNomeCompleto,
        primeiroNome: primeiroNomeDoValor(valorNome),
        sobrenome: valorSobrenome,
        email: valorEmail,
        fotoURL: credencial.user.photoURL || "",
        provedor: "password",
        emailVerificado: false,
        pontuacaoTotal: 0,
        criadoEm: serverTimestamp(),
        ultimoEmailVerificacaoEnviadoEm: serverTimestamp()
      }, { merge: true });
      await salvarIndiceEmail(credencial.user, valorEmail);
    } catch (erroPerfil) {
      console.warn("Conta criada, mas não foi possível salvar todos os dados do perfil.", erroPerfil);
      avisoPerfil = " Seu login já está ativo; revise o perfil depois.";
    }

    let verificacaoEnviada = false;

    try {
      await sendEmailVerification(credencial.user, configuracaoVerificacaoEmail());
      verificacaoEnviada = true;
    } catch (erroEmail) {
      console.warn("Conta criada, mas não foi possível enviar o e-mail de verificação.", erroEmail);
      avisoPerfil += " Não foi possível enviar o e-mail de confirmação agora; tente entrar depois para reenviar.";
    }

    nome.value = "";
    sobrenome.value = "";
    email.value = "";
    senha.value = "";
    confirmar.value = "";
    const mensagemCadastro = verificacaoEnviada
      ? "Cadastro realizado. Enviamos um link de confirmação para seu e-mail."
      : "Cadastro realizado, mas não foi possível enviar o e-mail de confirmação agora.";
    mostrarMensagem(`${mensagemCadastro}${avisoPerfil}`, verificacaoEnviada ? "sucesso" : "erro");
    await signOut(auth);

    if (verificacaoEnviada) {
      setTimeout(() => {
        window.location.href = "login.html?cadastro=verificar-email";
      }, 900);
    }
  } catch (erro) {
    mostrarMensagem(mensagemErroFirebase(erro));
  } finally {
    botao.disabled = false;
    botao.textContent = "Criar Conta";
  }
});
