const campoBusca = document.getElementById("buscaConteudos");
const formularioBusca = document.querySelector(".aprender-busca");
const resultadoBusca = document.getElementById("resultadoBuscaConteudos");
const cardsVideo = Array.from(document.querySelectorAll(".card-video"));
let destaqueAtual = null;
let temporizadorDestaque = null;
const palavrasIgnoradas = new Set(["a", "ao", "as", "com", "da", "de", "do", "dos", "e", "em", "na", "no", "o", "os", "para", "por", "um", "uma"]);

function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ç/g, "c");
}

function tokenizar(texto) {
  return normalizar(texto)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !palavrasIgnoradas.has(token))
    .map(simplificarToken);
}

function simplificarToken(token) {
  if (token.length > 5 && token.endsWith("oes")) return `${token.slice(0, -3)}ao`;
  if (token.length > 4 && token.endsWith("ais")) return `${token.slice(0, -3)}al`;
  if (token.length > 4 && token.endsWith("eis")) return `${token.slice(0, -3)}el`;
  if (token.length > 4 && token.endsWith("is")) return token.slice(0, -1);
  if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function distanciaLevenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const anterior = Array.from({ length: b.length + 1 }, (_, indice) => indice);
  const atual = Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    atual[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(
        atual[j - 1] + 1,
        anterior[j] + 1,
        anterior[j - 1] + custo
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      anterior[j] = atual[j];
    }
  }

  return anterior[b.length];
}

function limiteErro(token) {
  if (token.length <= 3) return 0;
  if (token.length <= 5) return 1;
  if (token.length <= 8) return 2;
  return 3;
}

function similaridadeToken(termo, tokenCard) {
  if (termo === tokenCard) return 4;
  if (termo.length >= 3 && tokenCard.includes(termo)) return 3;
  if (tokenCard.length >= 3 && termo.includes(tokenCard)) return 2;

  const distancia = distanciaLevenshtein(termo, tokenCard);
  if (distancia <= limiteErro(termo)) return distancia === 1 ? 2 : 1;

  return 0;
}

function textoIndexavel(card) {
  const partes = [
    card.querySelector("h3")?.textContent || "",
    card.querySelector("p")?.textContent || "",
    card.querySelector("img")?.alt || "",
    ...Array.from(card.querySelectorAll(".youtube-thumb-title")).map((elemento) => elemento.textContent || "")
  ];

  return partes.join(" ");
}

const indiceCards = cardsVideo.map((card, indice) => {
  const texto = textoIndexavel(card);
  const tokens = tokenizar(texto);

  return {
    card,
    indice,
    textoNormalizado: normalizar(texto),
    tokens,
    tokensUnicos: Array.from(new Set(tokens))
  };
});

function avaliarCard(item, termoNormalizado, tokensBusca) {
  if (!tokensBusca.length) return { encontrou: true, pontuacao: 0 };
  if (item.textoNormalizado.includes(termoNormalizado)) {
    return { encontrou: true, pontuacao: 100 + tokensBusca.length };
  }

  let pontuacao = 0;
  let correspondencias = 0;

  tokensBusca.forEach((tokenBusca) => {
    const melhor = item.tokensUnicos.reduce((maior, tokenCard) => {
      return Math.max(maior, similaridadeToken(tokenBusca, tokenCard));
    }, 0);

    if (melhor > 0) {
      correspondencias += 1;
      pontuacao += melhor;
    }
  });

  const encontrouTodos = correspondencias === tokensBusca.length && (tokensBusca.length > 1 || pontuacao >= 2);
  const encontrouParcialRelevante = tokensBusca.length === 1 && pontuacao >= 2;
  const encontrouMaioria = tokensBusca.length >= 3 && correspondencias >= Math.ceil(tokensBusca.length * 0.72);

  return {
    encontrou: encontrouTodos || encontrouParcialRelevante || encontrouMaioria,
    pontuacao
  };
}

function removerDestaqueAtual() {
  if (temporizadorDestaque) {
    clearTimeout(temporizadorDestaque);
    temporizadorDestaque = null;
  }

  if (!destaqueAtual) return;
  destaqueAtual.classList.remove("busca-destaque");
  destaqueAtual = null;
}

function destacarCard(card) {
  removerDestaqueAtual();
  destaqueAtual = card;
  card.classList.add("busca-destaque");

  temporizadorDestaque = setTimeout(() => {
    if (destaqueAtual === card) removerDestaqueAtual();
  }, 2200);
}

function rolarAteCard(card) {
  const topo = card.getBoundingClientRect().top + window.scrollY - 135;
  window.scrollTo({ top: Math.max(topo, 0), behavior: "smooth" });
}

function filtrarConteudos({ rolar = false } = {}) {
  const termo = normalizar(campoBusca?.value.trim() || "");
  const tokensBusca = tokenizar(campoBusca?.value || "");
  const resultados = indiceCards
    .map((item) => ({ ...item, resultado: avaliarCard(item, termo, tokensBusca) }))
    .filter((item) => item.resultado.encontrou)
    .sort((a, b) => b.resultado.pontuacao - a.resultado.pontuacao || a.indice - b.indice);
  const cardsEncontrados = resultados.map((item) => item.card);

  indiceCards.forEach(({ card }) => {
    const visivel = !termo || cardsEncontrados.includes(card);
    card.hidden = !visivel;
    card.classList.remove("busca-destaque");
  });

  if (!resultadoBusca) return;

  if (!termo) {
    resultadoBusca.textContent = "";
    removerDestaqueAtual();
    return;
  }

  const encontrados = cardsEncontrados.length;
  resultadoBusca.textContent = encontrados === 0
    ? "Nenhum conteúdo encontrado."
    : encontrados === 1
    ? "1 conteúdo encontrado."
    : `${encontrados} conteúdos encontrados.`;

  if (rolar && cardsEncontrados[0]) {
    rolarAteCard(cardsEncontrados[0]);
    destacarCard(cardsEncontrados[0]);
  }
}

campoBusca?.addEventListener("input", filtrarConteudos);
formularioBusca?.addEventListener("submit", (event) => {
  event.preventDefault();
  filtrarConteudos({ rolar: true });
});

function rolarParaAncoraAtual() {
  if (!window.location.hash) return;
  const destino = document.querySelector(window.location.hash);
  if (!destino) return;

  setTimeout(() => {
    const topo = destino.getBoundingClientRect().top + window.scrollY - 130;
    window.scrollTo({ top: Math.max(topo, 0), behavior: "smooth" });
  }, 250);
}

window.addEventListener("componentesProntos", rolarParaAncoraAtual);
window.addEventListener("load", rolarParaAncoraAtual);
rolarParaAncoraAtual();
setTimeout(rolarParaAncoraAtual, 900);
