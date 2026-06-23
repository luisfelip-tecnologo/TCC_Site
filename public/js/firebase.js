import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  signOut,
  reload,
  updateProfile,
  updateEmail,
  updatePassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

let app = null;
let auth = null;
let db = null;
let firebaseReady = false;

async function carregarConfigFirebase() {
  try {
    const resposta = await fetch("/__/firebase/init.json");
    if (resposta.ok) {
      return await resposta.json();
    }
  } catch (erro) {
    console.info("Configuração automática do Firebase indisponível no ambiente local.");
  }

  return {
    apiKey: "AIzaSyAs3KbJVtOth3FtNFgKOB485Bfa24S8HsI",
    authDomain: "viva-conectado-a89ac.firebaseapp.com",
    projectId: "viva-conectado-a89ac",
    storageBucket: "viva-conectado-a89ac.firebasestorage.app",
    messagingSenderId: "446830843554",
    appId: "1:446830843554:web:83b30ebfba1132fe59e9fb",
    measurementId: "G-7H2XMHZ18Q"
  };
}

const firebaseConfig = await carregarConfigFirebase();

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  auth.useDeviceLanguage();

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (erro) {
    console.warn("Não foi possível ativar a persistência local do Firebase Auth.", erro);
  }

  db = getFirestore(app);
  firebaseReady = true;
} else {
  console.warn("Firebase não configurado. Publique no Firebase Hosting ou preencha a configuração em js/firebase.js.");
}

const mensagensFirebase = {
  "auth/email-already-in-use": "Este e-mail já está cadastrado.",
  "auth/invalid-email": "Digite um e-mail válido.",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/wrong-password": "Senha atual incorreta.",
  "auth/missing-password": "Digite sua senha.",
  "auth/popup-closed-by-user": "Login cancelado antes da conclusão.",
  "auth/popup-blocked": "O navegador bloqueou a janela de login. Permita pop-ups e tente novamente.",
  "auth/cancelled-popup-request": "Uma tentativa de login com Google já está em andamento.",
  "auth/unauthorized-domain": "Este domínio não está autorizado no Firebase Authentication.",
  "auth/account-exists-with-different-credential": "Já existe uma conta com este e-mail usando outro método de login.",
  "auth/user-mismatch": "Confirme usando a mesma conta conectada ao perfil atual.",
  "auth/credential-already-in-use": "Esta credencial já está vinculada a outra conta.",
  "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente novamente.",
  "auth/operation-not-supported-in-this-environment": "Abra o site por http://localhost ou por um domínio publicado. Login Google não funciona abrindo o HTML direto pelo arquivo.",
  "auth/web-storage-unsupported": "O navegador bloqueou o armazenamento local necessário para manter a sessão.",
  "auth/operation-not-allowed": "Este método de login ainda não está habilitado no Firebase.",
  "auth/requires-recent-login": "Entre novamente na conta antes de alterar a senha.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente novamente.",
  "auth/user-not-found": "Não encontramos uma conta com este e-mail.",
  "auth/user-disabled": "Esta conta foi desativada. Entre em contato com o suporte.",
  "auth/expired-action-code": "Este link expirou. Solicite um novo e-mail.",
  "auth/invalid-action-code": "Este link não é válido ou já foi utilizado.",
  "auth/missing-action-code": "O link recebido está incompleto. Solicite um novo e-mail.",
  "auth/invalid-continue-uri": "O endereço de retorno configurado no Firebase é inválido.",
  "auth/unauthorized-continue-uri": "O domínio de retorno não está autorizado no Firebase.",
  "auth/weak-password": "Use uma senha com pelo menos 8 caracteres."
};

function mensagemErroFirebase(erro) {
  return mensagensFirebase[erro?.code] || "Não foi possível concluir a ação. Tente novamente.";
}

function primeiroNome(usuario) {
  const nome = usuario?.displayName || usuario?.nome || usuario?.email || "Usuário";
  return nome.trim().split(/\s+/)[0];
}

function usuarioPrecisaVerificarEmail(usuario) {
  const provedores = usuario?.providerData?.map((provedor) => provedor.providerId) || [];
  return Boolean(usuario?.email && provedores.includes("password") && !usuario.emailVerified);
}

export {
  auth,
  db,
  firebaseReady,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  signOut,
  reload,
  updateProfile,
  updateEmail,
  updatePassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  mensagemErroFirebase,
  primeiroNome,
  usuarioPrecisaVerificarEmail
};
