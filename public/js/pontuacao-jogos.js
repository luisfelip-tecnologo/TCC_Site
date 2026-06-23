import {
  db,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from "./firebase.js?v=4";

const configuracoesJogos = {
  memoria: {
    nome: "Jogo da Memória",
    pontos: 1200,
    tempoIdealSegundos: 150,
    alvosIdeais: 13
  },
  sudoku: { nome: "Sudoku", pontos: 1100, tempoIdealSegundos: 300, alvosIdeais: 14 },
  quebraCabeca: { nome: "Quebra-Cabeça", pontos: 850, tempoIdealSegundos: 150, alvosIdeais: 6 }
};

function nomeUsuario(usuario, perfil = {}) {
  return perfil.nome || usuario.displayName || usuario.email || "Usuário";
}

function textoSeguro(valor) {
  return String(valor || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function numeroSeguro(valor) {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
}

function normalizarItemRanking(dados = {}) {
  return {
    ...dados,
    id: dados.id || dados.uid || "",
    uid: dados.uid || dados.id || "",
    nome: dados.nome || "Usuário",
    pontuacaoTotal: numeroSeguro(dados.pontuacaoTotal ?? dados.pontuacao ?? dados.pontos ?? dados.melhorPontuacao)
  };
}

function normalizarRanking(ranking = []) {
  if (!Array.isArray(ranking)) return [];
  return ranking
    .map(normalizarItemRanking)
    .filter((dados) => dados.id || dados.uid);
}

function renderizarRankingLista(lista, ranking = [], mensagemVazia = "Nenhuma pontuação registrada ainda.") {
  if (!lista) return;

  const rankingNormalizado = normalizarRanking(ranking);

  if (!rankingNormalizado.length) {
    lista.innerHTML = `<li>${mensagemVazia}</li>`;
    return;
  }

  lista.innerHTML = "";
  rankingNormalizado.forEach((usuario, indice) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${indice + 1}º ${textoSeguro(usuario.nome)}</span><strong>${usuario.pontuacaoTotal} pontos</strong>`;
    lista.appendChild(li);
  });
}

async function calcularTotalMelhores(uid) {
  const snapshot = await getDocs(collection(db, "usuarios", uid, "pontuacoes"));
  let total = 0;

  snapshot.forEach((item) => {
    const dados = item.data();
    total += Number(dados.melhorPontuacao || dados.pontos || 0);
  });

  return total;
}

function limitarNumero(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor));
}

function calcularPontuacaoDesempenho(jogo, resultado = {}) {
  if (typeof resultado === "number") {
    return {
      pontos: resultado,
      acertos: 0,
      erros: 0,
      tentativas: 0,
      tempoSegundos: 0,
      desempenho: 100,
      precisao: 100,
      eficienciaTentativas: 100,
      eficienciaTempo: 100
    };
  }

  const pontosBase = Number(jogo?.pontos || resultado.pontosBase || 0);
  const acertos = Number(resultado.acertos || 0);
  const erros = Number(resultado.erros || 0);
  const tentativas = Math.max(Number(resultado.tentativas || acertos + erros || 1), 1);
  const tempoSegundos = Math.max(Number(resultado.tempoSegundos || 1), 1);
  const alvosIdeais = Math.max(Number(resultado.alvosIdeais || jogo?.alvosIdeais || acertos || 1), 1);
  const tempoIdeal = Math.max(Number(resultado.tempoIdealSegundos || jogo?.tempoIdealSegundos || 180), 1);

  const precisao = limitarNumero(acertos / tentativas, 0, 1);
  const eficienciaTentativas = limitarNumero(alvosIdeais / tentativas, 0, 1);
  const eficienciaTempo = limitarNumero(tempoIdeal / tempoSegundos, 0, 1);
  const fatorDesempenho = (precisao * 0.5) + (eficienciaTentativas * 0.3) + (eficienciaTempo * 0.2);
  const pontosMinimos = Math.round(pontosBase * 0.2);
  const pontosCalculados = Math.round(pontosBase * fatorDesempenho);

  return {
    pontos: limitarNumero(pontosCalculados, pontosMinimos, pontosBase),
    acertos,
    erros,
    tentativas,
    tempoSegundos,
    desempenho: Math.round(fatorDesempenho * 100),
    precisao: Math.round(precisao * 100),
    eficienciaTentativas: Math.round(eficienciaTentativas * 100),
    eficienciaTempo: Math.round(eficienciaTempo * 100)
  };
}

async function salvarPontuacaoUsuario(usuario, jogoId, resultado = 0) {
  const jogo = configuracoesJogos[jogoId];
  if (!usuario || !jogo) throw new Error("Jogo ou usuário inválido.");

  const pontuacaoCalculada = calcularPontuacaoDesempenho(jogo, resultado);
  const perfilRef = doc(db, "usuarios", usuario.uid);
  const pontuacaoRef = doc(db, "usuarios", usuario.uid, "pontuacoes", jogoId);
  const perfilSnap = await getDoc(perfilRef);
  const pontuacaoSnap = await getDoc(pontuacaoRef);
  const perfil = perfilSnap.exists() ? perfilSnap.data() : {};
  const pontuacaoAnterior = pontuacaoSnap.exists() ? pontuacaoSnap.data() : {};
  const melhorAnterior = Number(pontuacaoAnterior.melhorPontuacao || pontuacaoAnterior.pontos || 0);
  const melhorPontuacao = Math.max(melhorAnterior, pontuacaoCalculada.pontos);

  await setDoc(pontuacaoRef, {
    uid: usuario.uid,
    jogoId,
    nomeJogo: jogo.nome,
    pontos: pontuacaoCalculada.pontos,
    pontuacaoAtual: pontuacaoCalculada.pontos,
    melhorPontuacao,
    acertos: pontuacaoCalculada.acertos,
    erros: pontuacaoCalculada.erros,
    tentativas: pontuacaoCalculada.tentativas,
    tempoSegundos: pontuacaoCalculada.tempoSegundos,
    desempenho: pontuacaoCalculada.desempenho,
    precisao: pontuacaoCalculada.precisao,
    eficienciaTentativas: pontuacaoCalculada.eficienciaTentativas,
    eficienciaTempo: pontuacaoCalculada.eficienciaTempo,
    partidasJogadas: Number(pontuacaoAnterior.partidasJogadas || 0) + 1,
    atualizadoEm: serverTimestamp()
  }, { merge: true });

  const pontuacaoTotal = await calcularTotalMelhores(usuario.uid);

  await setDoc(perfilRef, {
    uid: usuario.uid,
    nome: nomeUsuario(usuario, perfil),
    email: usuario.email || perfil.email || "",
    fotoURL: usuario.photoURL || perfil.fotoURL || "",
    pontuacaoTotal,
    atualizadoEm: serverTimestamp()
  }, { merge: true });

  await setDoc(doc(db, "ranking", usuario.uid), {
    uid: usuario.uid,
    nome: nomeUsuario(usuario, perfil),
    fotoURL: usuario.photoURL || perfil.fotoURL || "",
    pontuacaoTotal,
    atualizadoEm: serverTimestamp()
  }, { merge: true });

  return {
    pontuacaoAtual: pontuacaoCalculada.pontos,
    melhorPontuacao,
    pontuacaoTotal,
    ...pontuacaoCalculada
  };
}

function observarPontuacaoUsuario(uid, jogoId, callback, onErro) {
  return onSnapshot(doc(db, "usuarios", uid, "pontuacoes", jogoId), (snapshot) => {
    callback(snapshot.exists() ? snapshot.data() : null);
  }, onErro);
}

function observarPontuacoesUsuario(uid, callback, onErro) {
  return onSnapshot(collection(db, "usuarios", uid, "pontuacoes"), (snapshot) => {
    const pontuacoes = {};
    snapshot.forEach((item) => {
      pontuacoes[item.id] = item.data();
    });
    callback(pontuacoes);
  }, onErro);
}

function observarRanking(callback, onErro) {
  const rankingQuery = query(collection(db, "ranking"), orderBy("pontuacaoTotal", "desc"), limit(10));

  return onSnapshot(rankingQuery, (snapshot) => {
    const ranking = [];
    snapshot.forEach((item) => ranking.push({ ...item.data(), id: item.id }));
    callback(normalizarRanking(ranking));
  }, onErro);
}

export {
  configuracoesJogos,
  calcularPontuacaoDesempenho,
  salvarPontuacaoUsuario,
  observarPontuacaoUsuario,
  observarPontuacoesUsuario,
  observarRanking,
  normalizarRanking,
  renderizarRankingLista
};
