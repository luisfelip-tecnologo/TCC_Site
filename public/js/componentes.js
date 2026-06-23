const componentes = [
  { id: "header", arquivo: "componentes/header.html" },
  { id: "navbar", arquivo: "componentes/navbar.html" },
  { id: "banner", arquivo: "componentes/banner.html" },
  { id: "footer", arquivo: "componentes/footer.html" }
];

async function carregarComponente({ id, arquivo }) {
  const destino = document.getElementById(id);
  if (!destino) return false;

  try {
    const resposta = await fetch(arquivo);
    if (!resposta.ok) throw new Error(`Erro ao carregar ${arquivo}`);

    destino.innerHTML = await resposta.text();

    if (id === "navbar") {
      marcarPaginaAtual(destino);
    }

    if (id === "header") {
      window.dispatchEvent(new Event("componentesCarregados"));
    }

    return true;
  } catch (erro) {
    console.error(erro);
    return false;
  }
}

function marcarPaginaAtual(navbar) {
  const paginaAtual = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const paginaNormalizada = paginaAtual === "" ? "index.html" : paginaAtual;

  navbar.querySelectorAll("a[href]").forEach((link) => {
    const destino = link.getAttribute("href").toLowerCase();
    if (destino === paginaNormalizada) {
      link.classList.add("ativo");
      link.setAttribute("aria-current", "page");
    }
  });
}

await Promise.all(componentes.map(carregarComponente));
window.dispatchEvent(new Event("componentesProntos"));
