import {
  auth,
  db,
  firebaseReady,
  onAuthStateChanged,
  signOut,
  updateProfile,
  updateEmail,
  updatePassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  GoogleAuthProvider,
  doc,
  getDoc,
  setDoc,
  getDocs,
  writeBatch,
  collection,
  onSnapshot,
  serverTimestamp,
  mensagemErroFirebase,
  usuarioPrecisaVerificarEmail
} from "./firebase.js?v=7";
import { emailPermitido, normalizarEmail, mensagemDominiosEmail, emailParaChaveSegura } from "./email-validacao.js";
import { normalizarRanking, observarRanking, renderizarRankingLista } from "./pontuacao-jogos.js?v=5";

const elementos = {
  mensagem: document.getElementById("mensagem"),
  mensagemSenha: document.getElementById("mensagemSenha"),
  nome: document.getElementById("nome"),
  email: document.getElementById("email"),
  senhaAtual: document.getElementById("senhaAtual"),
  novaSenha: document.getElementById("novaSenha"),
  confirmarNovaSenha: document.getElementById("confirmarNovaSenha"),
  salvarPerfil: document.getElementById("salvarPerfil"),
  salvarSenha: document.getElementById("salvarSenha"),
  excluirConta: document.getElementById("excluirConta"),
  preview: document.getElementById("preview"),
  foto: document.getElementById("foto"),
  nomeResumo: document.getElementById("perfilNomeResumo"),
  emailResumo: document.getElementById("perfilEmailResumo"),
  uid: document.getElementById("perfilUID"),
  criadoEm: document.getElementById("perfilCriadoEm"),
  ultimoLogin: document.getElementById("perfilUltimoLogin"),
  provedor: document.getElementById("perfilProvedor"),
  videosConcluidos: document.getElementById("perfilVideosConcluidos"),
  progresso: document.getElementById("perfilProgresso"),
  pontuacaoTotal: document.getElementById("perfilPontuacaoTotal"),
  rankingPosicao: document.getElementById("perfilRankingPosicao"),
  videosLista: document.getElementById("perfilVideosLista"),
  pontuacoesLista: document.getElementById("perfilPontuacoesLista"),
  rankingLista: document.getElementById("perfilRankingLista")
};

let usuarioAtual = null;
let perfilAtual = {};
let fotoSelecionada = "";
let fotoPerfilAtual = "";
let pararPerfil = null;
let pararProgresso = null;
let pararPontuacoes = null;
let pararRanking = null;

function mostrarMensagem(texto, tipo = "erro") {
  if (!texto) {
    elementos.mensagem.textContent = "";
    elementos.mensagem.className = "mensagem";
    return;
  }

  elementos.mensagem.textContent = texto;
  elementos.mensagem.className = tipo === "sucesso" ? "mensagem sucesso" : "mensagem erro";
}

function mostrarMensagemSenha(texto, tipo = "erro") {
  if (!texto) {
    elementos.mensagemSenha.textContent = "";
    elementos.mensagemSenha.className = "mensagem-senha";
    return;
  }

  elementos.mensagemSenha.textContent = texto;
  if (tipo === "sucesso") {
    elementos.mensagemSenha.className = "mensagem-senha sucesso";
  } else if (tipo === "info") {
    elementos.mensagemSenha.className = "mensagem-senha info";
  } else {
    elementos.mensagemSenha.className = "mensagem-senha erro";
  }
}

function mensagemLegivel(erro) {
  return erro?.code ? mensagemErroFirebase(erro) : erro?.message || mensagemErroFirebase(erro);
}

function textoSeguro(valor) {
  return String(valor || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function senhaForte(valor) {
  return valor.length >= 8 && /[A-Z]/.test(valor) && /\d/.test(valor);
}

function temProvedorSenha(usuario) {
  return usuario.providerData?.some((provedor) => provedor.providerId === "password");
}

function temProvedorGoogle(usuario) {
  return usuario.providerData?.some((provedor) => provedor.providerId === "google.com");
}

function formatarData(valor) {
  if (!valor) return "-";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function rotuloProvedor(usuario) {
  const providerId = usuario.providerData?.[0]?.providerId || "password";
  const nomes = {
    "google.com": "Google",
    password: "E-mail e senha"
  };
  return nomes[providerId] || providerId;
}

function nomeDoUsuario(usuario, perfil = {}) {
  return perfil.nome || usuario.displayName || usuario.email || "Usuário";
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

function fotoDoUsuario(usuario, perfil = {}) {
  return perfil.fotoURL || usuario.photoURL || "img/perfis/avatar.png";
}

function renderPerfil(usuario, perfil = {}) {
  perfilAtual = { ...perfil };
  const nome = nomeDoUsuario(usuario, perfil);
  const foto = fotoDoUsuario(usuario, perfil);
  const email = usuario.email || perfil.email || "";
  const usaSenha = temProvedorSenha(usuario);
  const podeAlterarEmail = usaSenha || temProvedorGoogle(usuario);

  fotoPerfilAtual = foto;
  elementos.nome.value = nome;
  elementos.email.value = email;
  elementos.preview.src = foto;
  elementos.nomeResumo.textContent = nome;
  elementos.emailResumo.textContent = email || "E-mail não informado";
  elementos.uid.textContent = usuario.uid;
  elementos.criadoEm.textContent = formatarData(usuario.metadata?.creationTime);
  elementos.ultimoLogin.textContent = formatarData(usuario.metadata?.lastSignInTime);
  elementos.provedor.textContent = perfil.provedor || rotuloProvedor(usuario);
  elementos.pontuacaoTotal.textContent = Number(perfil.pontuacaoTotal || 0);

  elementos.email.readOnly = !podeAlterarEmail;

  if (!podeAlterarEmail) {
    elementos.email.title = "Este provedor não permite alterar e-mail por esta tela.";
  } else if (temProvedorGoogle(usuario)) {
    elementos.email.title = "Ao salvar um novo e-mail, o Google pedirá confirmação da conta.";
  } else {
    elementos.email.removeAttribute("title");
  }

  if (!usaSenha) {
    elementos.senhaAtual.disabled = true;
    elementos.novaSenha.disabled = true;
    elementos.confirmarNovaSenha.disabled = true;
    elementos.salvarSenha.disabled = true;
    elementos.senhaAtual.placeholder = "Conta conectada pelo Google";
    elementos.novaSenha.placeholder = "Altere sua senha na conta Google";
    elementos.confirmarNovaSenha.placeholder = "Altere sua senha na conta Google";
    mostrarMensagemSenha("Contas Google não usam senha local no Viva Conectado.", "info");
  } else {
    elementos.senhaAtual.disabled = false;
    elementos.novaSenha.disabled = false;
    elementos.confirmarNovaSenha.disabled = false;
    elementos.salvarSenha.disabled = false;
    elementos.senhaAtual.placeholder = "Digite sua senha atual";
    elementos.novaSenha.placeholder = "Crie uma nova senha";
    elementos.confirmarNovaSenha.placeholder = "Repita a nova senha";

    if (elementos.mensagemSenha.classList.contains("info")) {
      mostrarMensagemSenha("");
    }
  }
}

function renderProgresso(dados = {}) {
  const videos = Array.isArray(dados.videosConcluidos) ? dados.videosConcluidos : [];
  const progresso = Number(dados.progressoGeral || 0);

  elementos.videosConcluidos.textContent = videos.length;
  elementos.progresso.textContent = `${progresso}%`;

  if (!videos.length) {
    elementos.videosLista.innerHTML = "<li>Nenhum vídeo concluído ainda.</li>";
    return;
  }

  elementos.videosLista.innerHTML = videos
    .map((videoId) => `<li><i class="bi bi-check-circle" aria-hidden="true"></i><span>${textoSeguro(videoId.replaceAll("-", " "))}</span></li>`)
    .join("");
}

function renderPontuacoes(snapshot) {
  if (!snapshot || snapshot.empty) {
    elementos.pontuacoesLista.innerHTML = "<li>Nenhuma pontuação salva ainda.</li>";
    return;
  }

  const itens = [];
  let total = 0;

  snapshot.forEach((item) => {
    const dados = item.data();
    const melhor = Number(dados.melhorPontuacao || dados.pontos || 0);
    total += melhor;
    itens.push(`
      <li>
        <i class="bi bi-controller" aria-hidden="true"></i>
        <span>${textoSeguro(dados.nomeJogo || item.id)}</span>
        <strong>${melhor} pontos</strong>
      </li>
    `);
  });

  elementos.pontuacoesLista.innerHTML = itens.join("");
  elementos.pontuacaoTotal.textContent = total;
}

function renderRanking(ranking = []) {
  const rankingNormalizado = normalizarRanking(ranking);
  renderizarRankingLista(elementos.rankingLista, rankingNormalizado);

  if (!rankingNormalizado.length || !usuarioAtual?.uid) {
    elementos.rankingPosicao.textContent = "-";
    return;
  }

  const indiceUsuario = rankingNormalizado.findIndex((dados) => (
    dados.id === usuarioAtual.uid || dados.uid === usuarioAtual.uid
  ));
  elementos.rankingPosicao.textContent = indiceUsuario >= 0 ? `${indiceUsuario + 1}º` : "-";
}

async function carregarFotoComoDataUrl(arquivo) {
  if (!arquivo) return "";
  if (arquivo.size > 450 * 1024) {
    throw new Error("Use uma imagem de até 450 KB para salvar no perfil.");
  }

  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result || ""));
    leitor.onerror = () => reject(new Error("Não foi possível ler a imagem escolhida."));
    leitor.readAsDataURL(arquivo);
  });
}

async function reautenticarComSenhaAtual() {
  const senhaAtual = elementos.senhaAtual.value.trim();

  if (!senhaAtual) {
    throw new Error("Digite sua senha atual para confirmar a alteração.");
  }

  if (!usuarioAtual.email) {
    throw new Error("Sua conta não possui e-mail para reautenticação por senha.");
  }

  const credencial = EmailAuthProvider.credential(usuarioAtual.email, senhaAtual);
  await reauthenticateWithCredential(usuarioAtual, credencial);
}

async function reautenticarParaAcaoSensivel() {
  if (temProvedorSenha(usuarioAtual)) {
    await reautenticarComSenhaAtual();
    return;
  }

  if (temProvedorGoogle(usuarioAtual)) {
    const provider = new GoogleAuthProvider();
    provider.addScope("profile");
    provider.addScope("email");
    await reauthenticateWithPopup(usuarioAtual, provider);
    return;
  }

  throw new Error("Este tipo de conta não permite confirmar identidade por esta tela.");
}

async function reautenticarParaAlterarEmail() {
  await reautenticarParaAcaoSensivel();
}

function fotoParaSalvar() {
  if (fotoSelecionada) return fotoSelecionada;
  if (fotoPerfilAtual) return fotoPerfilAtual;
  if (usuarioAtual?.photoURL) return usuarioAtual.photoURL;
  return "img/perfis/avatar.png";
}

async function salvarIndiceEmailPerfil(valorEmail) {
  const chaveEmail = await emailParaChaveSegura(valorEmail);

  if (!chaveEmail) {
    return;
  }

  await setDoc(doc(db, "emailsCadastrados", chaveEmail), {
    uid: usuarioAtual.uid,
    email: valorEmail,
    metodoSenha: temProvedorSenha(usuarioAtual),
    metodoGoogle: temProvedorGoogle(usuarioAtual),
    emailVerificado: temProvedorSenha(usuarioAtual) ? Boolean(usuarioAtual.emailVerified) : true,
    atualizadoEm: serverTimestamp()
  }, { merge: true });
}

async function excluirSnapshotEmLotes(snapshot) {
  if (!snapshot || snapshot.empty) return;

  let lote = writeBatch(db);
  let operacoes = 0;
  const commits = [];

  snapshot.forEach((item) => {
    lote.delete(item.ref);
    operacoes += 1;

    if (operacoes === 450) {
      commits.push(lote.commit());
      lote = writeBatch(db);
      operacoes = 0;
    }
  });

  if (operacoes) {
    commits.push(lote.commit());
  }

  await Promise.all(commits);
}

async function excluirSubcolecao(ref) {
  const snapshot = await getDocs(ref);
  await excluirSnapshotEmLotes(snapshot);
}

function emailsParaLimpar(usuario, perfil = {}) {
  return Array.from(new Set([
    normalizarEmail(usuario?.email || ""),
    normalizarEmail(perfil.email || ""),
    normalizarEmail(elementos.email?.value || "")
  ].filter(Boolean)));
}

async function excluirIndicesEmail(usuario, perfil = {}) {
  const lote = writeBatch(db);
  let operacoes = 0;

  for (const valorEmail of emailsParaLimpar(usuario, perfil)) {
    const chaveEmail = await emailParaChaveSegura(valorEmail);
    if (!chaveEmail) continue;

    const indiceRef = doc(db, "emailsCadastrados", chaveEmail);
    const indiceSnap = await getDoc(indiceRef);

    if (indiceSnap.exists() && indiceSnap.data()?.uid === usuario.uid) {
      lote.delete(indiceRef);
      operacoes += 1;
    }
  }

  if (operacoes) {
    await lote.commit();
  }
}

async function excluirDadosFirestore(usuario, perfil = {}) {
  const uid = usuario.uid;

  await Promise.all([
    excluirSubcolecao(collection(db, "usuarios", uid, "pontuacoes")),
    excluirSubcolecao(collection(db, "usuarios", uid, "aprendizado"))
  ]);

  await excluirIndicesEmail(usuario, perfil);

  const lote = writeBatch(db);
  lote.delete(doc(db, "ranking", uid));
  lote.delete(doc(db, "usuarios", uid));
  await lote.commit();
}

function limparInscricoes() {
  [pararPerfil, pararProgresso, pararPontuacoes, pararRanking].forEach((parar) => {
    if (typeof parar === "function") parar();
  });
  pararPerfil = null;
  pararProgresso = null;
  pararPontuacoes = null;
  pararRanking = null;
}

async function salvarPerfil() {
  if (!usuarioAtual) return;

  const novoNome = elementos.nome.value.trim();
  const nomeSeparado = separarNomeCompleto(novoNome);
  const novoEmail = normalizarEmail(elementos.email.value);
  const emailAtual = (usuarioAtual.email || "").toLowerCase();
  const emailMudou = novoEmail && novoEmail !== emailAtual;

  if (!novoNome) {
    mostrarMensagem("Digite seu nome.");
    return;
  }

  if (!emailPermitido(novoEmail)) {
    mostrarMensagem(mensagemDominiosEmail());
    return;
  }

  if (emailMudou && !temProvedorSenha(usuarioAtual) && !temProvedorGoogle(usuarioAtual)) {
    mostrarMensagem("Este tipo de conta não permite alterar e-mail por esta tela.");
    elementos.email.value = usuarioAtual.email || "";
    return;
  }

  elementos.salvarPerfil.disabled = true;
  elementos.salvarPerfil.textContent = "Salvando...";

  try {
    const fotoSalva = fotoParaSalvar();

    if (emailMudou) {
      await reautenticarParaAlterarEmail();
      await updateEmail(usuarioAtual, novoEmail);
    }

    await updateProfile(usuarioAtual, { displayName: nomeSeparado.nome });

    await setDoc(doc(db, "usuarios", usuarioAtual.uid), {
      uid: usuarioAtual.uid,
      nome: nomeSeparado.nome,
      primeiroNome: nomeSeparado.primeiroNome,
      sobrenome: nomeSeparado.sobrenome,
      email: novoEmail,
      fotoURL: fotoSalva,
      provedor: rotuloProvedor(usuarioAtual),
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    await salvarIndiceEmailPerfil(novoEmail);

    await setDoc(doc(db, "ranking", usuarioAtual.uid), {
      uid: usuarioAtual.uid,
      nome: nomeSeparado.nome,
      fotoURL: fotoSalva,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    fotoSelecionada = "";
    fotoPerfilAtual = fotoSalva;
    mostrarMensagem("Perfil atualizado com sucesso.", "sucesso");
  } catch (erro) {
    mostrarMensagem(mensagemLegivel(erro));
  } finally {
    elementos.salvarPerfil.disabled = false;
    elementos.salvarPerfil.textContent = "Salvar perfil";
  }
}

async function salvarSenha() {
  if (!usuarioAtual) return;

  if (!temProvedorSenha(usuarioAtual)) {
    mostrarMensagemSenha("Contas Google não usam senha local no Viva Conectado.");
    return;
  }

  const novaSenha = elementos.novaSenha.value.trim();
  const confirmar = elementos.confirmarNovaSenha.value.trim();

  if (!elementos.senhaAtual.value.trim() || !novaSenha || !confirmar) {
    mostrarMensagemSenha("Preencha senha atual, nova senha e confirmação.");
    return;
  }

  if (!senhaForte(novaSenha)) {
    mostrarMensagemSenha("A nova senha precisa ter pelo menos 8 caracteres, 1 letra maiúscula e 1 número.");
    return;
  }

  if (novaSenha !== confirmar) {
    mostrarMensagemSenha("A confirmação da nova senha não confere.");
    return;
  }

  elementos.salvarSenha.disabled = true;
  elementos.salvarSenha.textContent = "Salvando...";

  try {
    await reautenticarComSenhaAtual();
    await updatePassword(usuarioAtual, novaSenha);

    elementos.senhaAtual.value = "";
    elementos.novaSenha.value = "";
    elementos.confirmarNovaSenha.value = "";
    mostrarMensagemSenha("Senha alterada com sucesso.", "sucesso");
  } catch (erro) {
    mostrarMensagemSenha(mensagemLegivel(erro));
  } finally {
    elementos.salvarSenha.disabled = !temProvedorSenha(usuarioAtual);
    elementos.salvarSenha.textContent = "Salvar nova senha";
  }
}

function alternarBotaoExcluir(carregando) {
  if (!elementos.excluirConta) return;

  elementos.excluirConta.disabled = carregando;
  elementos.excluirConta.textContent = carregando ? "Excluindo..." : "Excluir Conta";
}

async function excluirConta() {
  if (!usuarioAtual) return;

  const confirmou = window.confirm("Tem certeza que deseja excluir sua conta?\nEsta ação não poderá ser desfeita.");
  if (!confirmou) return;

  alternarBotaoExcluir(true);
  mostrarMensagem("");
  mostrarMensagemSenha("");

  try {
    const usuarioParaExcluir = auth.currentUser || usuarioAtual;

    if (!usuarioParaExcluir) {
      throw new Error("Não foi possível identificar a conta conectada.");
    }

    await reautenticarParaAcaoSensivel();
    limparInscricoes();
    await excluirDadosFirestore(usuarioParaExcluir, perfilAtual);
    await deleteUser(usuarioParaExcluir);

    try {
      await signOut(auth);
    } catch (erroLogout) {
      console.warn("Conta excluída, mas não foi possível encerrar a sessão explicitamente.", erroLogout);
    }

    window.location.href = "index.html";
  } catch (erro) {
    mostrarMensagem(mensagemLegivel(erro));
    alternarBotaoExcluir(false);
  }
}

elementos.foto?.addEventListener("change", async () => {
  try {
    fotoSelecionada = await carregarFotoComoDataUrl(elementos.foto.files?.[0]);
    if (fotoSelecionada) {
      elementos.preview.src = fotoSelecionada;
      mostrarMensagem("Foto carregada. Clique em salvar perfil para gravar.", "sucesso");
    }
  } catch (erro) {
    fotoSelecionada = "";
    elementos.foto.value = "";
    mostrarMensagem(erro.message);
  }
});

elementos.salvarPerfil?.addEventListener("click", salvarPerfil);
elementos.salvarSenha?.addEventListener("click", salvarSenha);
elementos.excluirConta?.addEventListener("click", excluirConta);

if (!firebaseReady) {
  mostrarMensagem("Firebase não configurado. Publique no Firebase Hosting ou preencha js/firebase.js.");
} else {
  onAuthStateChanged(auth, async (usuario) => {
    limparInscricoes();

    if (!usuario) {
      window.location.href = "login.html";
      return;
    }

    if (usuarioPrecisaVerificarEmail(usuario)) {
      await signOut(auth);
      window.location.href = "login.html?cadastro=verificar-email";
      return;
    }

    usuarioAtual = usuario;

    const perfilRef = doc(db, "usuarios", usuario.uid);
    const progressoRef = doc(db, "usuarios", usuario.uid, "aprendizado", "progresso");
    const pontuacoesRef = collection(db, "usuarios", usuario.uid, "pontuacoes");

    const perfilInicial = await getDoc(perfilRef);
    renderPerfil(usuario, perfilInicial.exists() ? perfilInicial.data() : {});

    pararPerfil = onSnapshot(perfilRef, (snapshot) => {
      renderPerfil(usuario, snapshot.exists() ? snapshot.data() : {});
    });

    pararProgresso = onSnapshot(progressoRef, (snapshot) => {
      renderProgresso(snapshot.exists() ? snapshot.data() : {});
    }, (erro) => console.warn("Não foi possível carregar o progresso.", erro));

    pararPontuacoes = onSnapshot(pontuacoesRef, renderPontuacoes, (erro) => {
      console.warn("Não foi possível carregar pontuações.", erro);
      elementos.pontuacoesLista.innerHTML = "<li>Não foi possível carregar suas pontuações.</li>";
    });

    pararRanking = observarRanking(renderRanking, (erro) => {
      console.warn("Não foi possível carregar ranking.", erro);
      elementos.rankingLista.innerHTML = "<li>Não foi possível carregar o ranking.</li>";
    });
  });
}
