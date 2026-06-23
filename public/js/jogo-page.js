import {
  auth,
  firebaseReady,
  onAuthStateChanged,
  mensagemErroFirebase
} from "./firebase.js?v=4";
import {
  configuracoesJogos,
  calcularPontuacaoDesempenho,
  salvarPontuacaoUsuario,
  observarPontuacaoUsuario
} from "./pontuacao-jogos.js?v=5";

const jogoId = document.body.dataset.jogo;
const jogo = configuracoesJogos[jogoId];
const area = document.getElementById("areaJogo");
const mensagem = document.getElementById("mensagemJogo");
const salvar = document.getElementById("salvarPontuacao");
const pontuacaoInfo = document.createElement("p");
let usuarioAtual = null;
let jogoFinalizado = false;
let pontuacaoSalva = null;
let pararPontuacao = null;
let resultadoAtual = null;
let temporizadorMemoria = null;

pontuacaoInfo.className = "jogo-pontuacao-info";
salvar.parentElement.before(pontuacaoInfo);

function mostrarMensagem(texto) {
  mensagem.textContent = texto;
}

function renderPontuacao(dados = pontuacaoSalva) {
  const pontosAtuais = Number(resultadoAtual?.pontos || dados?.pontuacaoAtual || dados?.pontos || 0);
  const melhor = Number(dados?.melhorPontuacao || dados?.pontos || 0);

  if (!usuarioAtual) {
    pontuacaoInfo.innerHTML = pontosAtuais
      ? `
        <span class="pontuacao-linha"><span>Sua Pontuação Atual:</span><strong>${pontosAtuais} pontos</strong></span>
        <span class="pontuacao-linha"><span>Ranking</span><strong>Entre para salvar</strong></span>
      `
      : `<span class="pontuacao-linha"><span>Status</span><strong>Entre para salvar e ver sua melhor pontuação</strong></span>`;
    return;
  }

  pontuacaoInfo.innerHTML = `
    <span class="pontuacao-linha"><span>Sua Pontuação Atual:</span><strong>${pontosAtuais} pontos</strong></span>
    <span class="pontuacao-linha"><span>Melhor Pontuação:</span><strong>${melhor} pontos</strong></span>
  `;
}

function finalizarJogo(texto, resultado = null) {
  jogoFinalizado = true;
  resultadoAtual = resultado || resultadoAtual || jogo.pontos;
  salvar.disabled = false;
  mostrarMensagem(texto);
  renderPontuacao();
}

function embaralhar(lista) {
  const itens = [...lista];

  for (let indice = itens.length - 1; indice > 0; indice -= 1) {
    const sorteado = Math.floor(Math.random() * (indice + 1));
    [itens[indice], itens[sorteado]] = [itens[sorteado], itens[indice]];
  }

  return itens;
}

function formatarTempo(segundos) {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return `${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
}

function montarMemoria() {
  const temas = [
    ["senha", "Senha forte", "bi-shield-lock"],
    ["wifi", "Wi-Fi seguro", "bi-wifi"],
    ["golpe", "Golpes", "bi-exclamation-triangle"],
    ["banco", "Banco online", "bi-bank"],
    ["email", "E-mail", "bi-envelope-check"],
    ["video", "Videochamada", "bi-camera-video"],
    ["whatsapp", "WhatsApp", "bi-chat-dots"],
    ["gov", "Gov.br", "bi-building-lock"],
    ["nuvem", "Nuvem", "bi-cloud-check"],
    ["antivirus", "Antivírus", "bi-bug"],
    ["privacidade", "Privacidade", "bi-eye-slash"],
    ["atualizacao", "Atualização", "bi-arrow-repeat"]
  ];
  const pares = temas.flatMap(([valor, rotulo, icone]) => [
    { valor, rotulo, icone },
    { valor, rotulo, icone }
  ]);
  const bonus = {
    valor: "bonus",
    rotulo: "Dica bônus",
    icone: "bi-lightbulb",
    bonus: true
  };
  const cartas = embaralhar([...pares, bonus]);
  const estado = {
    selecionadas: [],
    paresEncontrados: 0,
    bonusEncontrado: false,
    bloqueado: false,
    acertos: 0,
    erros: 0,
    tentativas: 0,
    inicio: null,
    fim: null,
    totalAlvos: 13
  };

  area.innerHTML = `
    <div class="memoria-status" aria-live="polite">
      <span><strong id="memoriaAcertos">0</strong> Acertos</span>
      <span><strong id="memoriaErros">0</strong> Erros</span>
      <span><strong id="memoriaTentativas">0</strong> Tentativas</span>
      <span><strong id="memoriaTempo">00:00</strong> Tempo</span>
      <span><strong id="memoriaPontos">${jogo.pontos}</strong> Pontos Possíveis</span>
    </div>
    <div class="memoria-grade" aria-label="Jogo da memória com 5 colunas e 5 linhas"></div>
  `;

  const grade = area.querySelector(".memoria-grade");
  const elementosMemoria = {
    acertos: document.getElementById("memoriaAcertos"),
    erros: document.getElementById("memoriaErros"),
    tentativas: document.getElementById("memoriaTentativas"),
    tempo: document.getElementById("memoriaTempo"),
    pontos: document.getElementById("memoriaPontos")
  };

  function tempoAtual() {
    if (!estado.inicio) return 0;
    const fim = estado.fim || Date.now();
    return Math.max(1, Math.round((fim - estado.inicio) / 1000));
  }

  function resultadoMemoria() {
    return calcularPontuacaoDesempenho(jogo, {
      acertos: estado.acertos,
      erros: estado.erros,
      tentativas: estado.tentativas || estado.totalAlvos,
      tempoSegundos: tempoAtual(),
      alvosIdeais: estado.totalAlvos
    });
  }

  function resultadoProjetadoMemoria() {
    return calcularPontuacaoDesempenho(jogo, {
      acertos: estado.totalAlvos,
      erros: estado.erros,
      tentativas: estado.totalAlvos + estado.erros,
      tempoSegundos: tempoAtual() || 1,
      alvosIdeais: estado.totalAlvos
    });
  }

  function atualizarStatus() {
    const resultado = estado.fim ? resultadoMemoria() : resultadoProjetadoMemoria();
    elementosMemoria.acertos.textContent = estado.acertos;
    elementosMemoria.erros.textContent = estado.erros;
    elementosMemoria.tentativas.textContent = estado.tentativas;
    elementosMemoria.tempo.textContent = formatarTempo(tempoAtual());
    elementosMemoria.pontos.textContent = resultado.pontos;
  }

  function iniciarRelogio() {
    if (estado.inicio) return;
    estado.inicio = Date.now();
    temporizadorMemoria = setInterval(atualizarStatus, 1000);
  }

  function conteudoCarta(carta, visivel = false) {
    if (!visivel) {
      carta.innerHTML = `
        <span class="memoria-carta-conteudo memoria-verso">
          <i class="bi bi-question-lg" aria-hidden="true"></i>
          <strong>?</strong>
        </span>
      `;
      return;
    }

    carta.innerHTML = `
      <span class="memoria-carta-conteudo">
        <i class="bi ${carta.dataset.icone}" aria-hidden="true"></i>
        <strong>${carta.dataset.rotulo}</strong>
      </span>
    `;
  }

  function verificarConclusao() {
    if (estado.paresEncontrados !== temas.length || !estado.bonusEncontrado) return;

    estado.fim = Date.now();
    if (temporizadorMemoria) clearInterval(temporizadorMemoria);
    const resultado = resultadoMemoria();
    resultadoAtual = resultado;
    atualizarStatus();
    finalizarJogo(`Parabéns! Você concluiu o jogo da memória com ${resultado.pontos} pontos, ${estado.acertos} acertos e ${estado.erros} erros.`, resultado);
  }

  cartas.forEach((item, indice) => {
    const carta = document.createElement("button");
    carta.type = "button";
    carta.className = "memoria-carta";
    carta.dataset.valor = item.valor;
    carta.dataset.rotulo = item.rotulo;
    carta.dataset.icone = item.icone;
    carta.dataset.indice = String(indice);
    if (item.bonus) carta.classList.add("memoria-bonus");
    carta.setAttribute("aria-label", "Carta fechada");
    conteudoCarta(carta);

    carta.addEventListener("click", () => {
      if (estado.bloqueado || carta.classList.contains("virada") || carta.classList.contains("encontrada") || jogoFinalizado) return;

      iniciarRelogio();
      carta.classList.add("virada");
      carta.setAttribute("aria-label", `Carta ${carta.dataset.rotulo}`);
      conteudoCarta(carta, true);

      if (item.bonus) {
        carta.classList.add("encontrada");
        estado.bonusEncontrado = true;
        estado.acertos += 1;
        estado.tentativas += 1;
        atualizarStatus();
        verificarConclusao();
        return;
      }

      estado.selecionadas.push(carta);

      if (estado.selecionadas.length === 2) {
        const [primeira, segunda] = estado.selecionadas;
        estado.tentativas += 1;
        if (primeira.dataset.valor === segunda.dataset.valor) {
          primeira.classList.add("encontrada");
          segunda.classList.add("encontrada");
          estado.paresEncontrados += 1;
          estado.acertos += 1;
          estado.selecionadas = [];
          atualizarStatus();
          verificarConclusao();
        } else {
          estado.erros += 1;
          estado.bloqueado = true;
          primeira.classList.add("incorreta");
          segunda.classList.add("incorreta");
          atualizarStatus();
          setTimeout(() => {
            primeira.classList.remove("virada");
            segunda.classList.remove("virada");
            primeira.classList.remove("incorreta");
            segunda.classList.remove("incorreta");
            primeira.setAttribute("aria-label", "Carta fechada");
            segunda.setAttribute("aria-label", "Carta fechada");
            conteudoCarta(primeira);
            conteudoCarta(segunda);
            estado.selecionadas = [];
            estado.bloqueado = false;
          }, 700);
        }
      }
    });

    grade.appendChild(carta);
  });

  atualizarStatus();
}

function montarSudoku() {
  const solucao = [
    1, 2, 3, 4, 5, 6,
    4, 5, 6, 1, 2, 3,
    2, 3, 4, 5, 6, 1,
    5, 6, 1, 2, 3, 4,
    3, 4, 5, 6, 1, 2,
    6, 1, 2, 3, 4, 5
  ];
  const editaveis = new Set([1, 4, 6, 9, 11, 13, 15, 18, 20, 22, 25, 28, 32, 34]);
  const estado = {
    verificacoes: 0,
    erros: 0,
    inicio: null,
    fim: null,
    totalAlvos: editaveis.size
  };
  let temporizadorSudoku = null;
  let marcarRespostas = false;

  area.innerHTML = `
    <div class="jogo-status sudoku-status" aria-live="polite">
      <span><strong id="sudokuAcertos">0</strong> Acertos</span>
      <span><strong id="sudokuErros">0</strong> Erros</span>
      <span><strong id="sudokuVerificacoes">0</strong> Verificações</span>
      <span><strong id="sudokuTempo">00:00</strong> Tempo</span>
      <span><strong id="sudokuPontos">${jogo.pontos}</strong> Pontos Possíveis</span>
    </div>
    <div class="jogo-ajuda">
      <i class="bi bi-info-circle" aria-hidden="true"></i>
      <span>Preencha os espaços em branco. Cada linha, coluna e bloco usa os números de 1 a 6.</span>
    </div>
    <div class="sudoku-grade" aria-label="Sudoku 6 por 6"></div>
  `;

  const grade = area.querySelector(".sudoku-grade");
  const elementosSudoku = {
    acertos: document.getElementById("sudokuAcertos"),
    erros: document.getElementById("sudokuErros"),
    verificacoes: document.getElementById("sudokuVerificacoes"),
    tempo: document.getElementById("sudokuTempo"),
    pontos: document.getElementById("sudokuPontos")
  };

  function tempoAtual() {
    if (!estado.inicio) return 0;
    const fim = estado.fim || Date.now();
    return Math.max(1, Math.round((fim - estado.inicio) / 1000));
  }

  function iniciarRelogio() {
    if (estado.inicio) return;
    estado.inicio = Date.now();
    temporizadorSudoku = setInterval(atualizarStatus, 1000);
  }

  function analisarRespostas() {
    const inputs = Array.from(area.querySelectorAll(".sudoku-celula-editavel"));
    let corretos = 0;
    let incorretos = 0;
    let vazios = 0;

    inputs.forEach((input) => {
      const valor = input.value.trim();
      input.classList.remove("correto", "incorreto", "vazio");

      if (!valor) {
        vazios += 1;
        if (marcarRespostas) input.classList.add("vazio");
        return;
      }

      if (valor === input.dataset.resposta) {
        corretos += 1;
        if (marcarRespostas) input.classList.add("correto");
      } else {
        incorretos += 1;
        if (marcarRespostas) input.classList.add("incorreto");
      }
    });

    return { corretos, incorretos, vazios };
  }

  function resultadoSudoku(analise = analisarRespostas()) {
    return calcularPontuacaoDesempenho(jogo, {
      acertos: estado.totalAlvos,
      erros: estado.erros + analise.incorretos,
      tentativas: estado.totalAlvos + estado.erros + analise.incorretos + Math.max(0, estado.verificacoes - 1),
      tempoSegundos: tempoAtual() || 1,
      alvosIdeais: estado.totalAlvos
    });
  }

  function atualizarStatus() {
    const analise = analisarRespostas();
    const resultado = estado.fim ? resultadoAtual : resultadoSudoku(analise);

    elementosSudoku.acertos.textContent = analise.corretos;
    elementosSudoku.erros.textContent = estado.erros;
    elementosSudoku.verificacoes.textContent = estado.verificacoes;
    elementosSudoku.tempo.textContent = formatarTempo(tempoAtual());
    elementosSudoku.pontos.textContent = resultado?.pontos || jogo.pontos;
  }

  solucao.forEach((valor, indice) => {
    if (editaveis.has(indice)) {
      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "numeric";
      input.maxLength = 1;
      input.className = "sudoku-celula-editavel";
      input.dataset.resposta = valor;
      input.setAttribute("aria-label", `Linha ${Math.floor(indice / 6) + 1}, coluna ${(indice % 6) + 1}`);
      input.addEventListener("input", () => {
        iniciarRelogio();
        input.value = input.value.replace(/[^1-6]/g, "").slice(0, 1);
        input.classList.remove("correto", "incorreto", "vazio");
        atualizarStatus();
      });
      grade.appendChild(input);
    } else {
      const fixo = document.createElement("span");
      fixo.className = "sudoku-celula-fixa";
      fixo.textContent = valor;
      grade.appendChild(fixo);
    }
  });

  const verificar = document.createElement("button");
  verificar.className = "btn-jogar";
  verificar.type = "button";
  verificar.textContent = "Verificar respostas";
  verificar.addEventListener("click", () => {
    iniciarRelogio();
    marcarRespostas = true;
    estado.verificacoes += 1;
    const analise = analisarRespostas();
    const errosDaRodada = analise.incorretos;

    if (errosDaRodada) {
      estado.erros += errosDaRodada;
    }

    if (analise.vazios) {
      const detalheErros = errosDaRodada ? ` ${errosDaRodada} resposta(s) também precisam de revisão.` : "";
      mostrarMensagem(`Ainda faltam ${analise.vazios} espaços para preencher.${detalheErros}`);
      atualizarStatus();
      return;
    }

    if (errosDaRodada) {
      mostrarMensagem(`${errosDaRodada} resposta(s) precisam de revisão. Corrija e tente novamente.`);
      atualizarStatus();
      return;
    }

    estado.fim = Date.now();
    if (temporizadorSudoku) clearInterval(temporizadorSudoku);
    const resultado = resultadoSudoku({ corretos: estado.totalAlvos, incorretos: 0, vazios: 0 });
    resultadoAtual = resultado;
    area.querySelectorAll(".sudoku-celula-editavel").forEach((input) => {
      input.disabled = true;
      input.classList.add("correto");
    });
    atualizarStatus();
    finalizarJogo(`Muito bem! Sudoku concluído com ${resultado.pontos} pontos, ${estado.totalAlvos} acertos e ${estado.erros} erros.`, resultado);
  });

  area.appendChild(verificar);
  atualizarStatus();
}

function montarQuebraCabeca() {
  const correto = [
    { id: "site", texto: "Conferir se está no site ou aplicativo oficial", icone: "bi-globe2" },
    { id: "seguranca", texto: "Verificar cadeado, endereço e sinais de segurança", icone: "bi-shield-check" },
    { id: "login", texto: "Entrar com e-mail e senha com atenção", icone: "bi-person-lock" },
    { id: "confirmacao", texto: "Confirmar código ou dupla autenticação, se solicitado", icone: "bi-patch-check" },
    { id: "servico", texto: "Usar apenas o serviço necessário", icone: "bi-ui-checks-grid" },
    { id: "sair", texto: "Sair da conta ao terminar", icone: "bi-box-arrow-right" }
  ];
  let itens = embaralhar(correto);

  if (itens.every((item, indice) => item.id === correto[indice].id)) {
    itens = [itens[1], itens[0], ...itens.slice(2)];
  }

  const estado = {
    verificacoes: 0,
    erros: 0,
    movimentos: 0,
    inicio: null,
    fim: null,
    totalAlvos: correto.length
  };
  let temporizadorQuebra = null;

  area.innerHTML = `
    <div class="jogo-status quebra-status" aria-live="polite">
      <span><strong id="quebraAcertos">0</strong> Posições Certas</span>
      <span><strong id="quebraErros">0</strong> Erros</span>
      <span><strong id="quebraMovimentos">0</strong> Movimentos</span>
      <span><strong id="quebraTempo">00:00</strong> Tempo</span>
      <span><strong id="quebraPontos">${jogo.pontos}</strong> Pontos Possíveis</span>
    </div>
    <div class="jogo-ajuda">
      <i class="bi bi-info-circle" aria-hidden="true"></i>
      <span>Use as setas para colocar as etapas na ordem mais segura.</span>
    </div>
    <div class="sequencia-lista" aria-label="Sequência do quebra-cabeça"></div>
  `;

  const lista = area.querySelector(".sequencia-lista");
  const elementosQuebra = {
    acertos: document.getElementById("quebraAcertos"),
    erros: document.getElementById("quebraErros"),
    movimentos: document.getElementById("quebraMovimentos"),
    tempo: document.getElementById("quebraTempo"),
    pontos: document.getElementById("quebraPontos")
  };

  function tempoAtual() {
    if (!estado.inicio) return 0;
    const fim = estado.fim || Date.now();
    return Math.max(1, Math.round((fim - estado.inicio) / 1000));
  }

  function iniciarRelogio() {
    if (estado.inicio) return;
    estado.inicio = Date.now();
    temporizadorQuebra = setInterval(atualizarStatus, 1000);
  }

  function contarPosicoesCertas() {
    return itens.filter((item, indice) => item.id === correto[indice].id).length;
  }

  function resultadoQuebra(acertosAtuais = contarPosicoesCertas()) {
    return calcularPontuacaoDesempenho(jogo, {
      acertos: estado.totalAlvos,
      erros: estado.erros + (estado.totalAlvos - acertosAtuais),
      tentativas: estado.totalAlvos + estado.erros + Math.ceil(estado.movimentos / 2) + Math.max(0, estado.verificacoes - 1),
      tempoSegundos: tempoAtual() || 1,
      alvosIdeais: estado.totalAlvos
    });
  }

  function atualizarStatus() {
    const acertosAtuais = contarPosicoesCertas();
    const resultado = estado.fim ? resultadoAtual : resultadoQuebra(acertosAtuais);

    elementosQuebra.acertos.textContent = acertosAtuais;
    elementosQuebra.erros.textContent = estado.erros;
    elementosQuebra.movimentos.textContent = estado.movimentos;
    elementosQuebra.tempo.textContent = formatarTempo(tempoAtual());
    elementosQuebra.pontos.textContent = resultado?.pontos || jogo.pontos;
  }

  function moverItem(indice, direcao) {
    const novoIndice = indice + direcao;
    if (novoIndice < 0 || novoIndice >= itens.length || jogoFinalizado) return;

    iniciarRelogio();
    [itens[indice], itens[novoIndice]] = [itens[novoIndice], itens[indice]];
    estado.movimentos += 1;
    mostrarMensagem("");
    renderizar();
    atualizarStatus();
  }

  function renderizar(mostrarResultado = false) {
    lista.innerHTML = "";

    itens.forEach((item, indice) => {
      const estaCorreto = item.id === correto[indice].id;
      const card = document.createElement("article");
      card.className = `sequencia-item${mostrarResultado ? (estaCorreto ? " correto" : " incorreto") : ""}`;
      card.innerHTML = `
        <span class="sequencia-ordem">${indice + 1}</span>
        <i class="bi ${item.icone}" aria-hidden="true"></i>
        <span class="sequencia-texto">${item.texto}</span>
        <span class="sequencia-controles">
          <button type="button" aria-label="Mover etapa para cima"${indice === 0 || jogoFinalizado ? " disabled" : ""}>
            <i class="bi bi-arrow-up" aria-hidden="true"></i>
          </button>
          <button type="button" aria-label="Mover etapa para baixo"${indice === itens.length - 1 || jogoFinalizado ? " disabled" : ""}>
            <i class="bi bi-arrow-down" aria-hidden="true"></i>
          </button>
        </span>
      `;

      const [subir, descer] = card.querySelectorAll("button");
      subir.addEventListener("click", () => moverItem(indice, -1));
      descer.addEventListener("click", () => moverItem(indice, 1));
      lista.appendChild(card);
    });
  }

  const verificar = document.createElement("button");
  verificar.className = "btn-jogar";
  verificar.type = "button";
  verificar.textContent = "Verificar sequência";
  verificar.addEventListener("click", () => {
    iniciarRelogio();
    estado.verificacoes += 1;
    const acertosAtuais = contarPosicoesCertas();
    const errosDaRodada = estado.totalAlvos - acertosAtuais;

    if (errosDaRodada) {
      estado.erros += errosDaRodada;
      renderizar(true);
      atualizarStatus();
      mostrarMensagem(`${acertosAtuais} etapa(s) estão na posição correta. Ajuste a sequência e tente novamente.`);
      return;
    }

    estado.fim = Date.now();
    if (temporizadorQuebra) clearInterval(temporizadorQuebra);
    const resultado = resultadoQuebra(estado.totalAlvos);
    resultadoAtual = resultado;
    renderizar(true);
    atualizarStatus();
    finalizarJogo(`Sequência correta! Quebra-cabeça concluído com ${resultado.pontos} pontos, ${estado.movimentos} movimentos e ${estado.erros} erros.`, resultado);
  });

  renderizar();
  area.appendChild(verificar);
  atualizarStatus();
}

async function salvarPontuacao() {
  if (!usuarioAtual) {
    window.location.href = "login.html";
    return;
  }

  if (!jogoFinalizado) {
    mostrarMensagem("Conclua o jogo antes de salvar a pontuação.");
    return;
  }

  salvar.disabled = true;
  salvar.textContent = "Salvando...";

  try {
    const pontuacao = await salvarPontuacaoUsuario(usuarioAtual, jogoId, resultadoAtual || jogo.pontos);
    pontuacaoSalva = pontuacao;
    renderPontuacao(pontuacao);
    const detalhes = pontuacao.tentativas
      ? ` Desempenho: ${pontuacao.desempenho}%, ${pontuacao.acertos} acertos, ${pontuacao.erros} erros e ${pontuacao.tentativas} tentativas.`
      : "";
    mostrarMensagem(`Pontuação salva: ${pontuacao.pontuacaoAtual} pontos. Melhor Pontuação: ${pontuacao.melhorPontuacao} pontos.${detalhes}`);
  } catch (erro) {
    salvar.disabled = false;
    mostrarMensagem(mensagemErroFirebase(erro));
  } finally {
    salvar.textContent = "Salvar pontuação";
  }
}

if (jogoId === "memoria") montarMemoria();
if (jogoId === "sudoku") montarSudoku();
if (jogoId === "quebraCabeca") montarQuebraCabeca();

salvar.disabled = true;
salvar.addEventListener("click", salvarPontuacao);
renderPontuacao();

if (firebaseReady) {
  onAuthStateChanged(auth, (usuario) => {
    usuarioAtual = usuario;
    if (pararPontuacao) pararPontuacao();

    if (!usuarioAtual) {
      pontuacaoSalva = null;
      renderPontuacao();
      return;
    }

    pararPontuacao = observarPontuacaoUsuario(usuarioAtual.uid, jogoId, (pontuacao) => {
      pontuacaoSalva = pontuacao;
      renderPontuacao(pontuacao);
    }, (erro) => {
      console.warn("Não foi possível carregar a pontuação do jogo.", erro);
      renderPontuacao();
    });
  });
} else {
  mostrarMensagem("Firebase não configurado para salvar pontuação.");
}
