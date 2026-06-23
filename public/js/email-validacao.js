const DOMINIOS_EMAIL_PERMITIDOS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "me.com",
  "uol.com.br",
  "bol.com.br",
  "terra.com.br",
  "proton.me",
  "protonmail.com"
];

function normalizarEmail(valor = "") {
  return String(valor).trim().toLowerCase();
}

function emailPermitido(valor = "") {
  const email = normalizarEmail(valor);
  const partes = email.split("@");

  if (partes.length !== 2 || !/^[^\s@]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) {
    return false;
  }

  const [usuario, dominio] = partes;
  if (!usuario || dominio.includes("..")) {
    return false;
  }

  return DOMINIOS_EMAIL_PERMITIDOS.includes(dominio);
}

function mensagemDominiosEmail() {
  return "Use um e-mail válido de um domínio reconhecido, como gmail.com, outlook.com ou hotmail.com.";
}

async function emailParaChaveSegura(valor = "") {
  const email = normalizarEmail(valor);

  if (!email) {
    return "";
  }

  if (window.crypto?.subtle && window.TextEncoder) {
    const bytes = new TextEncoder().encode(email);
    const hash = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export {
  DOMINIOS_EMAIL_PERMITIDOS,
  normalizarEmail,
  emailPermitido,
  mensagemDominiosEmail,
  emailParaChaveSegura
};
