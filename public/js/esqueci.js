import {
  auth,
  db,
  firebaseReady,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  doc,
  getDoc,
  mensagemErroFirebase
} from "./firebase.js?v=6";
import { emailPermitido, normalizarEmail, mensagemDominiosEmail, emailParaChaveSegura } from "./email-validacao.js";

const formulario = document.getElementById("formRecuperar");
const email = document.getElementById("email");
const mensagem = document.getElementById("mensagem");

function mostrarMensagem(texto, tipo = "erro") {
  mensagem.textContent = texto;
  mensagem.className = tipo === "sucesso" ? "mensagem sucesso" : "mensagem erro";
}

function configuracaoRecuperacaoSenha() {
  // A página customizada vem da Action URL do Firebase Console; aqui fica o retorno final.
  return {
    url: `${window.location.origin}/login.html?senha=alterada`,
    handleCodeInApp: false
  };
}

async function buscarEmailNoIndice(valorEmail) {
  const chaveEmail = await emailParaChaveSegura(valorEmail);

  if (!chaveEmail) {
    return { existe: null, permiteSenha: null };
  }

  try {
    const cadastro = await getDoc(doc(db, "emailsCadastrados", chaveEmail));

    if (!cadastro.exists()) {
      return { existe: false, permiteSenha: null };
    }

    const dados = cadastro.data();
    return {
      existe: true,
      permiteSenha: dados.metodoSenha !== false
    };
  } catch (erro) {
    console.warn("Não foi possível consultar o índice de e-mails cadastrados.", erro);
    return { existe: null, permiteSenha: null };
  }
}

async function verificarCadastroDoEmail(valorEmail) {
  const resultadoIndice = await buscarEmailNoIndice(valorEmail);

  if (resultadoIndice.existe === true) {
    return resultadoIndice;
  }

  try {
    const metodos = await fetchSignInMethodsForEmail(auth, valorEmail);

    if (metodos.length > 0) {
      return {
        existe: true,
        permiteSenha: metodos.includes("password")
      };
    }

    if (resultadoIndice.existe === false) {
      return { existe: false, permiteSenha: null };
    }

    return { existe: false, permiteSenha: null };
  } catch (erro) {
    console.warn("Não foi possível verificar previamente os métodos de login do e-mail.", erro);
    return resultadoIndice;
  }
}

formulario?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!firebaseReady) {
    mostrarMensagem("Firebase não configurado. Publique no Firebase Hosting ou preencha js/firebase.js.");
    return;
  }

  const valorEmail = normalizarEmail(email.value);
  if (!valorEmail) {
    mostrarMensagem("Digite seu e-mail para recuperar a senha.");
    return;
  }

  if (!emailPermitido(valorEmail)) {
    mostrarMensagem(mensagemDominiosEmail());
    return;
  }

  const botao = formulario.querySelector("button[type='submit']");
  botao.disabled = true;
  botao.textContent = "Enviando...";

  try {
    const cadastroEmail = await verificarCadastroDoEmail(valorEmail);

    if (cadastroEmail.existe === false) {
      mostrarMensagem("Não encontramos uma conta cadastrada com este e-mail.");
      return;
    }

    if (cadastroEmail.existe === true && cadastroEmail.permiteSenha === false) {
      mostrarMensagem("Esta conta foi criada com Google. Use o botão Entrar com Google na tela de login.");
      return;
    }

    await sendPasswordResetEmail(auth, valorEmail, configuracaoRecuperacaoSenha());
    mostrarMensagem("Enviamos um link seguro de recuperação para o seu e-mail. Verifique a caixa de entrada e o spam.", "sucesso");
    formulario.reset();
  } catch (erro) {
    mostrarMensagem(mensagemErroFirebase(erro));
  } finally {
    botao.disabled = false;
    botao.textContent = "Enviar instruções";
  }
});
