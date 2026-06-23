function inicializarAcessibilidade() {
  const html = document.documentElement;
  const btnAumentar = document.getElementById("aumentar-fonte");
  const btnDiminuir = document.getElementById("diminuir-fonte");
  const btnContraste = document.getElementById("autocontraste");

  if (!btnAumentar || !btnDiminuir || !btnContraste || btnAumentar.dataset.acessibilidade === "ativa") {
    aplicarPreferenciasSalvas();
    return;
  }

  btnAumentar.dataset.acessibilidade = "ativa";
  btnDiminuir.dataset.acessibilidade = "ativa";
  btnContraste.dataset.acessibilidade = "ativa";

  let tamanhoAtual = localStorage.getItem("tamanhoFonte")
    ? parseInt(localStorage.getItem("tamanhoFonte"), 10)
    : 100;

  function atualizarFonte(novoTamanho) {
    tamanhoAtual = novoTamanho;
    html.style.fontSize = `${tamanhoAtual}%`;
    localStorage.setItem("tamanhoFonte", String(tamanhoAtual));
  }

  btnAumentar.addEventListener("click", () => {
    if (tamanhoAtual < 150) atualizarFonte(tamanhoAtual + 10);
  });

  btnDiminuir.addEventListener("click", () => {
    if (tamanhoAtual > 80) atualizarFonte(tamanhoAtual - 10);
  });

  btnContraste.addEventListener("click", () => {
    document.body.classList.toggle("contraste-alto");
    localStorage.setItem("contraste", String(document.body.classList.contains("contraste-alto")));
  });

  aplicarPreferenciasSalvas();
}

function aplicarPreferenciasSalvas() {
  const tamanhoSalvo = parseInt(localStorage.getItem("tamanhoFonte") || "100", 10);
  document.documentElement.style.fontSize = `${tamanhoSalvo}%`;
  document.body.classList.toggle("contraste-alto", localStorage.getItem("contraste") === "true");
}

document.addEventListener("DOMContentLoaded", inicializarAcessibilidade);
window.addEventListener("componentesCarregados", inicializarAcessibilidade);
