import {
  auth,
  db,
  firebaseReady,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
  usuarioPrecisaVerificarEmail
} from "./firebase.js?v=4";

let unsubscribeAuth = null;
let fecharDropdownAtual = null;

function textoSeguro(valor) {
  return String(valor || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nomeUsuario(usuario, dadosPerfil) {
  return dadosPerfil?.nome || usuario?.displayName || usuario?.email || "Usuário";
}

function primeiroNomeTexto(valor = "") {
  return String(valor || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0] || "Usuário";
}

function nomeCabecalho(usuario, dadosPerfil) {
  return dadosPerfil?.primeiroNome || primeiroNomeTexto(nomeUsuario(usuario, dadosPerfil));
}

function fotoUsuario(usuario, dadosPerfil) {
  return dadosPerfil?.fotoURL || usuario?.photoURL || "img/perfis/avatar.png";
}

function caminhoAtualEhPerfil() {
  return window.location.pathname.toLowerCase().endsWith("/perfil.html");
}

function limparSessaoLocalDoApp() {
  const chavesPreservadas = new Set(["tamanhoFonte", "contraste"]);

  try {
    Object.keys(localStorage).forEach((chave) => {
      if (!chavesPreservadas.has(chave) && !chave.startsWith("firebase:")) {
        localStorage.removeItem(chave);
      }
    });
    sessionStorage.clear();
  } catch (erro) {
    console.warn("Não foi possível limpar todos os dados locais da sessão.", erro);
  }
}

function renderLogin(areaPerfil) {
  removerListenerDropdown();

  areaPerfil.innerHTML = `
    <a href="login.html" class="login-acao" aria-label="Entrar na conta" title="Entrar">
      <i class="bi bi-person" aria-hidden="true"></i>
      <span>Entrar</span>
    </a>
    <a href="Cadastro.html" class="cadastro-acao">Cadastrar</a>
  `;
}

function renderCarregando(areaPerfil) {
  removerListenerDropdown();

  areaPerfil.innerHTML = `
    <span class="login-acao login-acao-carregando" aria-label="Verificando login" title="Verificando login">
      <i class="bi bi-person" aria-hidden="true"></i>
      <span>Conta</span>
    </span>
  `;
}

function alternarMenu(botaoPerfil, menuPerfil) {
  const abriu = menuPerfil.classList.toggle("fixo");
  botaoPerfil.setAttribute("aria-expanded", String(abriu));
}

function fecharMenu(botaoPerfil, menuPerfil) {
  menuPerfil.classList.remove("fixo");
  botaoPerfil.setAttribute("aria-expanded", "false");
}

function removerListenerDropdown() {
  if (fecharDropdownAtual) {
    document.removeEventListener("click", fecharDropdownAtual);
    fecharDropdownAtual = null;
  }
}

async function sairDaConta(areaPerfil, botaoSair) {
  if (!firebaseReady || !auth) {
    renderLogin(areaPerfil);
    return;
  }

  const textoOriginal = botaoSair.innerHTML;
  botaoSair.setAttribute("aria-disabled", "true");
  botaoSair.innerHTML = `<i class="bi bi-hourglass-split" aria-hidden="true"></i> Saindo...`;

  try {
    await signOut(auth);
    limparSessaoLocalDoApp();
    renderLogin(areaPerfil);

    if (caminhoAtualEhPerfil()) {
      window.location.href = "login.html";
    }
  } catch (erro) {
    console.error("Erro ao sair da conta.", erro);
    botaoSair.removeAttribute("aria-disabled");
    botaoSair.innerHTML = textoOriginal;
    alert("Não foi possível sair da conta agora. Tente novamente.");
  }
}

function renderPerfil(areaPerfil, usuario, dadosPerfil) {
  removerListenerDropdown();

  const nomeCompleto = textoSeguro(nomeUsuario(usuario, dadosPerfil));
  const nome = textoSeguro(nomeCabecalho(usuario, dadosPerfil));
  const foto = textoSeguro(fotoUsuario(usuario, dadosPerfil));

  areaPerfil.innerHTML = `
    <div class="perfil-dropdown">
      <span class="bem-vindo">Bem-vindo, ${nome}</span>
      <button class="perfil-botao" type="button" aria-label="Abrir menu do perfil" aria-expanded="false">
        <img class="perfil-icone-img" src="${foto}" alt="Foto de ${nomeCompleto}">
        <i class="bi bi-chevron-down perfil-seta" aria-hidden="true"></i>
      </button>
      <div class="dropdown-conteudo" role="menu">
        <a href="perfil.html" role="menuitem"><i class="bi bi-person-lines-fill" aria-hidden="true"></i> Meu Perfil</a>
        <button class="dropdown-sair" type="button" role="menuitem">
          <i class="bi bi-box-arrow-right" aria-hidden="true"></i>
          <span>Sair da Conta</span>
        </button>
      </div>
    </div>
  `;

  const dropdown = areaPerfil.querySelector(".perfil-dropdown");
  const botaoPerfil = areaPerfil.querySelector(".perfil-botao");
  const menuPerfil = areaPerfil.querySelector(".dropdown-conteudo");
  const botaoSair = areaPerfil.querySelector(".dropdown-sair");

  botaoPerfil.addEventListener("click", (event) => {
    event.stopPropagation();
    alternarMenu(botaoPerfil, menuPerfil);
  });

  botaoSair.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await sairDaConta(areaPerfil, botaoSair);
  });

  fecharDropdownAtual = (event) => {
    if (!dropdown.contains(event.target)) {
      fecharMenu(botaoPerfil, menuPerfil);
    }
  };

  document.addEventListener("click", fecharDropdownAtual);
}

async function carregarDadosPerfil(usuario) {
  try {
    const perfil = await getDoc(doc(db, "usuarios", usuario.uid));
    return perfil.exists() ? perfil.data() : null;
  } catch (erro) {
    console.warn("Não foi possível carregar o perfil do usuário.", erro);
    return null;
  }
}

async function atualizarMenuPerfil() {
  const areaPerfil = document.querySelector(".header-perfil");
  if (!areaPerfil) return;

  renderCarregando(areaPerfil);

  if (!firebaseReady) {
    renderLogin(areaPerfil);
    return;
  }

  if (unsubscribeAuth) unsubscribeAuth();

  unsubscribeAuth = onAuthStateChanged(auth, async (usuario) => {
    if (!usuario) {
      renderLogin(areaPerfil);
      return;
    }

    if (usuarioPrecisaVerificarEmail(usuario)) {
      await signOut(auth);
      limparSessaoLocalDoApp();
      renderLogin(areaPerfil);
      return;
    }

    const dadosPerfil = await carregarDadosPerfil(usuario);
    renderPerfil(areaPerfil, usuario, dadosPerfil);
  });
}

window.addEventListener("componentesCarregados", atualizarMenuPerfil);
document.addEventListener("DOMContentLoaded", atualizarMenuPerfil);
atualizarMenuPerfil();
