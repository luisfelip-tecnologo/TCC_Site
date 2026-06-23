import {
  auth,
  db,
  firebaseReady,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "./firebase.js?v=4";

const cards = Array.from(document.querySelectorAll(".card-video"));
let usuarioAtual = null;
let concluidos = new Set();
let salvando = new Set();
let youtubeApiPronta = null;

function criarIdVideo(card, indice) {
  const titulo = card.querySelector("h3")?.textContent || `conteudo-${indice + 1}`;
  return titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function prepararCards() {
  cards.forEach((card, indice) => {
    const videoId = criarIdVideo(card, indice);
    const iframe = card.querySelector("iframe");
    card.dataset.videoId = videoId;
    card.dataset.status = "nao-concluido";

    const controles = document.createElement("div");
    controles.className = "video-progresso-acoes";
    controles.innerHTML = `
      <span class="video-status">Não concluído</span>
      <button type="button" class="btn-video-concluir">Marcar como concluído</button>
    `;
    card.appendChild(controles);

    iframe?.addEventListener("mouseenter", () => {
      if (!concluidos.has(videoId)) {
        card.dataset.status = "em-andamento";
        card.querySelector(".video-status").textContent = "Em andamento";
      }
    });

    card.querySelector(".btn-video-concluir").addEventListener("click", () => concluirVideo(videoId));
  });
}

function carregarYoutubeApi() {
  if (youtubeApiPronta) return youtubeApiPronta;

  youtubeApiPronta = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);

    const callbackAnterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof callbackAnterior === "function") callbackAnterior();
      resolve(window.YT);
    };
  });

  return youtubeApiPronta;
}

function habilitarApiYoutube(iframe) {
  if (!iframe?.src || !iframe.src.includes("youtube.com/embed/")) return false;

  const url = new URL(iframe.src);
  url.searchParams.set("enablejsapi", "1");
  url.searchParams.set("origin", window.location.origin);
  iframe.src = url.toString();
  return true;
}

async function observarFimDosVideos() {
  const iframesYoutube = cards
    .map((card) => ({ card, iframe: card.querySelector("iframe") }))
    .filter(({ iframe }) => habilitarApiYoutube(iframe));

  if (!iframesYoutube.length) return;

  const YT = await carregarYoutubeApi();

  iframesYoutube.forEach(({ card, iframe }) => {
    new YT.Player(iframe, {
      events: {
        onStateChange(event) {
          if (event.data === YT.PlayerState.ENDED) {
            concluirVideo(card.dataset.videoId, "video");
          }
        }
      }
    });
  });
}

function renderResumo() {
  const total = cards.length;
  const quantidade = concluidos.size;
  const porcentagem = total ? Math.round((quantidade / total) * 100) : 0;
  const resumo = document.getElementById("resumoProgresso");

  if (!resumo) return;

  resumo.innerHTML = `
    <div class="progresso-info">
      <strong>Seu progresso</strong>
      <span>${porcentagem}% (${quantidade} de ${total} conteúdos)</span>
    </div>
    <div class="barra-progresso" aria-label="Progresso dos conteúdos">
      <span style="width: ${porcentagem}%"></span>
    </div>
  `;
}

function atualizarCards() {
  cards.forEach((card) => {
    const videoId = card.dataset.videoId;
    const status = card.querySelector(".video-status");
    const botao = card.querySelector(".btn-video-concluir");

    if (concluidos.has(videoId)) {
      card.dataset.status = "concluido";
      status.textContent = "Concluído";
      botao.textContent = "Concluído";
      botao.disabled = true;
    } else if (salvando.has(videoId)) {
      status.textContent = "Salvando...";
      botao.textContent = "Salvando...";
      botao.disabled = true;
    } else if (!usuarioAtual) {
      status.textContent = "Entre para salvar";
      botao.textContent = "Fazer login";
      botao.disabled = false;
    } else {
      if (card.dataset.status !== "em-andamento") {
        status.textContent = "Não concluído";
      }
      botao.textContent = "Marcar como concluído";
      botao.disabled = false;
    }
  });

  renderResumo();
}

async function carregarProgresso() {
  concluidos = new Set();
  if (!usuarioAtual) {
    atualizarCards();
    return;
  }

  try {
    const ref = doc(db, "usuarios", usuarioAtual.uid, "aprendizado", "progresso");
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) {
      concluidos = new Set(snapshot.data().videosConcluidos || []);
    }
  } catch (erro) {
    console.warn("Não foi possível carregar o progresso dos vídeos.", erro);
  }

  atualizarCards();
}

async function concluirVideo(videoId, origem = "manual") {
  if (!usuarioAtual) {
    if (origem === "manual") window.location.href = "login.html";
    return;
  }

  if (concluidos.has(videoId) || salvando.has(videoId)) return;

  concluidos.add(videoId);
  salvando.add(videoId);
  atualizarCards();

  const total = cards.length;
  const porcentagem = total ? Math.round((concluidos.size / total) * 100) : 0;

  try {
    await setDoc(doc(db, "usuarios", usuarioAtual.uid, "aprendizado", "progresso"), {
      uid: usuarioAtual.uid,
      videosConcluidos: Array.from(concluidos),
      progressoGeral: porcentagem,
      atualizadoEm: serverTimestamp(),
      conclusoes: {
        [videoId]: new Date().toISOString()
      }
    }, { merge: true });
  } catch (erro) {
    concluidos.delete(videoId);
    console.warn("Não foi possível salvar o progresso do vídeo.", erro);
  } finally {
    salvando.delete(videoId);
  }

  atualizarCards();
}

prepararCards();
renderResumo();
observarFimDosVideos();

if (firebaseReady) {
  onAuthStateChanged(auth, async (usuario) => {
    usuarioAtual = usuario;
    await carregarProgresso();
  });
} else {
  atualizarCards();
}
