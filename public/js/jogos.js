import {
  auth,
  firebaseReady,
  onAuthStateChanged
} from "./firebase.js?v=4";
import {
  configuracoesJogos,
  observarPontuacoesUsuario,
  observarRanking,
  renderizarRankingLista
} from "./pontuacao-jogos.js?v=5";

let usuarioAtual = null;
let pararPontuacoes = null;
let pararRanking = null;

function renderPontuacoes(pontuacoes = {}) {
  Object.keys(configuracoesJogos).forEach((jogoId) => {
    const resultado = document.getElementById(`resultado-${jogoId}`);
    if (!resultado) return;

    if (!usuarioAtual) {
      resultado.textContent = "Entre para ver e salvar sua pontuação.";
      return;
    }

    const dados = pontuacoes[jogoId] || {};
    const atual = Number(dados.pontuacaoAtual || dados.pontos || 0);
    const melhor = Number(dados.melhorPontuacao || dados.pontos || 0);
    const desempenho = dados.desempenho
      ? `<span class="resultado-linha"><span>Desempenho:</span><strong>${Number(dados.desempenho)}%</strong></span>`
      : "";
    resultado.innerHTML = `
      <span class="resultado-linha"><span>Sua Pontuação Atual:</span><strong>${atual} pontos</strong></span>
      <span class="resultado-linha"><span>Melhor Pontuação:</span><strong>${melhor} pontos</strong></span>
      ${desempenho}
    `;
  });
}

function renderRanking(ranking) {
  const lista = document.getElementById("rankingLista");
  renderizarRankingLista(lista, ranking);
}

if (firebaseReady) {
  pararRanking = observarRanking(renderRanking, (erro) => {
    console.warn("Não foi possível carregar o ranking.", erro);
    const lista = document.getElementById("rankingLista");
    if (lista) lista.innerHTML = "<li>Não foi possível carregar o ranking agora.</li>";
  });

  onAuthStateChanged(auth, (usuario) => {
    usuarioAtual = usuario;
    if (pararPontuacoes) pararPontuacoes();

    if (!usuarioAtual) {
      renderPontuacoes();
      return;
    }

    pararPontuacoes = observarPontuacoesUsuario(usuarioAtual.uid, renderPontuacoes, (erro) => {
      console.warn("Não foi possível carregar suas pontuações.", erro);
      renderPontuacoes();
    });
  });
} else {
  if (pararRanking) pararRanking();
  const lista = document.getElementById("rankingLista");
  if (lista) lista.innerHTML = "<li>Firebase não configurado para carregar ranking.</li>";
  renderPontuacoes();
}
