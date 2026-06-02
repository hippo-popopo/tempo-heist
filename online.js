const onlinePanel = document.getElementById("onlinePanel");
const onlineLobby = document.getElementById("onlineLobby");
const roomLobby = document.getElementById("roomLobby");
const duelArena = document.getElementById("duelArena");
const firebaseWarning = document.getElementById("firebaseWarning");
const onlineMessage = document.getElementById("onlineMessage");
const roomMessage = document.getElementById("roomMessage");
const agentNameInput = document.getElementById("agentNameInput");
const roomCodeInput = document.getElementById("roomCodeInput");
const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const hostName = document.getElementById("hostName");
const guestName = document.getElementById("guestName");
const guestStatus = document.getElementById("guestStatus");
const copyCodeButton = document.getElementById("copyCodeButton");
const startDuelButton = document.getElementById("startDuelButton");
const myOnlineName = document.getElementById("myOnlineName");
const opponentOnlineName = document.getElementById("opponentOnlineName");
const myOnlineScore = document.getElementById("myOnlineScore");
const opponentOnlineScore = document.getElementById("opponentOnlineScore");
const onlineRound = document.getElementById("onlineRound");
const onlineSignalLight = document.getElementById("onlineSignalLight");
const onlineStatusLabel = document.getElementById("onlineStatusLabel");
const onlineTimer = document.getElementById("onlineTimer");
const onlineEstimateBox = document.getElementById("onlineEstimateBox");
const onlineEstimateInput = document.getElementById("onlineEstimateInput");
const onlineConsoleCopy = document.getElementById("onlineConsoleCopy");
const onlineActionButton = document.getElementById("onlineActionButton");
const onlineButtonText = document.getElementById("onlineButtonText");
const onlineButtonIcon = document.getElementById("onlineButtonIcon");
const duelRoundResult = document.getElementById("duelRoundResult");
const nextOnlineRoundButton = document.getElementById("nextOnlineRoundButton");

const databaseURL = (window.TEMPO_HEIST_FIREBASE?.databaseURL || "").replace(/\/$/, "");
const playerId = sessionStorage.getItem("tempoHeistPlayer") || crypto.randomUUID();
sessionStorage.setItem("tempoHeistPlayer", playerId);

let roomCode = "";
let roomData = null;
let isHost = false;
let pollTimer = null;
let localRound = -1;
let localState = "waiting";
let localStartedAt = 0;
let localSignalTimeout = null;

function firebaseReady() {
  return Boolean(databaseURL);
}

function roomUrl(path = "") {
  return `${databaseURL}/tempo-heist/rooms/${roomCode}${path}.json`;
}

async function request(path = "", options = {}) {
  if (!firebaseReady()) throw new Error("Ajoute l'URL Firebase dans firebase-config.js.");
  const response = await fetch(roomUrl(path), {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) throw new Error(`Firebase a répondu ${response.status}. Vérifie les règles de la base.`);
  return response.json();
}

function cleanName() {
  return (agentNameInput.value.trim() || "AGENT 07").slice(0, 14).toUpperCase();
}

function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function generateRounds() {
  return Array.from({ length: 5 }, () => ({
    challenge: Math.random() < .5 ? "reproduce" : "estimate",
    target: Math.round((2.25 + Math.random() * 6.5) * 100) / 100
  }));
}

function setOnlineButton(text, icon = "◆", disabled = false) {
  onlineButtonText.textContent = text;
  onlineButtonIcon.textContent = icon;
  onlineActionButton.disabled = disabled;
}

function showOnlineView(view) {
  onlineLobby.classList.toggle("hidden", view !== "entry");
  roomLobby.classList.toggle("hidden", view !== "lobby");
  duelArena.classList.toggle("hidden", view !== "duel");
}

function onlineRenderTime(value) {
  const [seconds, centis] = value.toFixed(2).split(".");
  onlineTimer.innerHTML = `<span>00</span><i>:</i><span>${seconds}</span><i>.</i><small>${centis}</small>`;
  onlineTimer.classList.remove("blind");
}

function onlineRenderHidden() {
  onlineTimer.innerHTML = "<span>••</span><i>:</i><span>••</span><i>.</i><small>••</small>";
  onlineTimer.classList.add("blind");
}

function answersForCurrentRound() {
  return roomData?.players && Object.values(roomData.players).map(player => player.answers?.[roomData.currentRound]).filter(Boolean);
}

function playersArray() {
  return roomData?.players ? Object.entries(roomData.players) : [];
}

function scores() {
  return Object.fromEntries(playersArray().map(([id, player]) => [
    id,
    Object.values(player.answers || {}).reduce((sum, answer) => sum + answer.points, 0)
  ]));
}

function renderLobby() {
  const players = playersArray();
  const host = players.find(([id]) => id === roomData.hostId)?.[1];
  const guest = players.find(([id]) => id !== roomData.hostId)?.[1];
  roomCodeDisplay.textContent = roomCode;
  hostName.textContent = host?.name || "...";
  guestName.textContent = guest?.name || "EN ATTENTE";
  guestStatus.textContent = guest ? "CONNECTÉ" : "CONNEXION...";
  startDuelButton.disabled = !isHost || !guest;
  startDuelButton.classList.toggle("hidden", !isHost);
  roomMessage.textContent = guest ? "Deux agents connectés. Le coffre est prêt." : "En attente du second agent...";
}

function renderDuelRound() {
  const duelRound = roomData.rounds[roomData.currentRound];
  const roundScores = scores();
  const opponent = playersArray().find(([id]) => id !== playerId);
  myOnlineName.textContent = roomData.players[playerId]?.name || "TOI";
  opponentOnlineName.textContent = opponent?.[1]?.name || "ADVERSAIRE";
  myOnlineScore.textContent = roundScores[playerId] || 0;
  opponentOnlineScore.textContent = opponent ? roundScores[opponent[0]] || 0 : 0;
  onlineRound.textContent = String(roomData.currentRound + 1).padStart(2, "0");

  if (localRound === roomData.currentRound) {
    renderAnswers();
    return;
  }

  clearTimeout(localSignalTimeout);
  localRound = roomData.currentRound;
  localState = "ready";
  onlineSignalLight.classList.remove("on");
  onlineEstimateBox.classList.add("hidden");
  onlineEstimateInput.value = "";
  duelRoundResult.classList.add("hidden");
  nextOnlineRoundButton.classList.add("hidden");

  if (duelRound.challenge === "reproduce") {
    onlineStatusLabel.textContent = "DUEL / REPRODUIRE";
    onlineRenderTime(duelRound.target);
    onlineConsoleCopy.textContent = "Mémorise cette cible. Lance ton chrono invisible lorsque tu es prêt.";
    setOnlineButton("LANCER MON CHRONO", "⌖");
  } else {
    onlineStatusLabel.textContent = "DUEL / ESTIMER";
    onlineRenderHidden();
    onlineConsoleCopy.textContent = "Active le signal lorsque tu es prêt. Ton adversaire joue de son côté.";
    setOnlineButton("ACTIVER MON SIGNAL", "✦");
  }
}

function renderAnswers() {
  const answers = answersForCurrentRound();
  const ownAnswer = roomData.players[playerId]?.answers?.[roomData.currentRound];
  if (!ownAnswer) return;
  const opponentAnswer = answers.find(answer => answer.playerId !== playerId);
  const won = opponentAnswer && ownAnswer.error < opponentAnswer.error;
  const draw = opponentAnswer && ownAnswer.error === opponentAnswer.error;
  onlineStatusLabel.textContent = opponentAnswer ? "RÉSULTATS DU VERROU" : "RÉPONSE ENVOYÉE";
  onlineConsoleCopy.textContent = opponentAnswer ? "Les deux réponses sont verrouillées." : "En attente de la réponse adverse...";
  duelRoundResult.innerHTML = opponentAnswer
    ? `<strong>${won ? "VERROU REMPORTÉ" : draw ? "ÉGALITÉ" : "VERROU PERDU"}</strong><br>
       Toi : <b>${formatSeconds(ownAnswer.guessed)} S</b> · écart ${formatSeconds(ownAnswer.error)} S
       &nbsp; / &nbsp; Adversaire : <b>${formatSeconds(opponentAnswer.guessed)} S</b> · écart ${formatSeconds(opponentAnswer.error)} S`
    : `Ta réponse : <b>${formatSeconds(ownAnswer.guessed)} S</b>. Canal adverse en attente...`;
  duelRoundResult.classList.remove("hidden");
  setOnlineButton("RÉPONSE VERROUILLÉE", "✓", true);
  if (opponentAnswer && isHost) nextOnlineRoundButton.classList.remove("hidden");
  if (opponentAnswer && !isHost) onlineConsoleCopy.textContent += " L'hôte ouvre le verrou suivant.";
}

async function refreshRoom() {
  try {
    const data = await request();
    if (!data) throw new Error("Ce salon n'existe plus.");
    roomData = data;
    if (roomData.status === "lobby") {
      showOnlineView("lobby");
      renderLobby();
    } else {
      showOnlineView("duel");
      renderDuelRound();
    }
  } catch (error) {
    roomMessage.textContent = error.message;
  }
}

function startPolling() {
  clearInterval(pollTimer);
  refreshRoom();
  pollTimer = setInterval(refreshRoom, 1100);
}

async function createRoom() {
  try {
    onlineMessage.textContent = "";
    roomCode = generateCode();
    isHost = true;
    const room = {
      hostId: playerId,
      status: "lobby",
      currentRound: 0,
      createdAt: Date.now(),
      rounds: generateRounds(),
      players: { [playerId]: { name: cleanName(), answers: {} } }
    };
    await request("", { method: "PUT", body: JSON.stringify(room) });
    startPolling();
  } catch (error) {
    onlineMessage.textContent = error.message;
  }
}

async function joinRoom() {
  try {
    onlineMessage.textContent = "";
    roomCode = roomCodeInput.value.trim().toUpperCase();
    if (roomCode.length !== 5) throw new Error("Entre un code de salon à cinq caractères.");
    const existing = await request();
    if (!existing) throw new Error("Salon introuvable.");
    if (existing.status !== "lobby") throw new Error("Ce duel a déjà commencé.");
    if (Object.keys(existing.players || {}).length >= 2) throw new Error("Ce salon est déjà complet.");
    isHost = false;
    await request(`/players/${playerId}`, { method: "PUT", body: JSON.stringify({ name: cleanName(), answers: {} }) });
    startPolling();
  } catch (error) {
    onlineMessage.textContent = error.message;
  }
}

async function launchDuel() {
  if (!isHost) return;
  await request("", { method: "PATCH", body: JSON.stringify({ status: "playing", currentRound: 0 }) });
  refreshRoom();
}

function startOnlineChallenge() {
  const duelRound = roomData.rounds[roomData.currentRound];
  if (duelRound.challenge === "reproduce") {
    localState = "reproducing";
    localStartedAt = performance.now();
    onlineRenderHidden();
    onlineStatusLabel.textContent = "CHRONO INVISIBLE / EN COURS";
    onlineConsoleCopy.textContent = "Coupe ton verrou au moment exact.";
    setOnlineButton("COUPER MON VERROU", "✦");
    return;
  }

  localState = "signal";
  onlineSignalLight.classList.add("on");
  onlineStatusLabel.textContent = "SIGNAL LUMINEUX / OBSERVE";
  onlineConsoleCopy.textContent = "La lumière s'éteindra seule. Ressens sa durée.";
  setOnlineButton("SIGNAL EN COURS", "✦", true);
  localSignalTimeout = setTimeout(() => {
    localState = "estimating";
    onlineSignalLight.classList.remove("on");
    onlineEstimateBox.classList.remove("hidden");
    onlineEstimateInput.focus();
    onlineStatusLabel.textContent = "SIGNAL ÉTEINT / À TOI";
    onlineConsoleCopy.textContent = "Combien de temps la lumière est-elle restée allumée ?";
    setOnlineButton("VALIDER MON ESTIMATION", "✓");
  }, duelRound.target * 1000);
}

async function submitOnlineAnswer(guessed) {
  const duelRound = roomData.rounds[roomData.currentRound];
  const error = Math.abs(guessed - duelRound.target);
  const points = Math.max(0, Math.round(1000 - error * 650));
  localState = "submitted";
  await request(`/players/${playerId}/answers/${roomData.currentRound}`, {
    method: "PUT",
    body: JSON.stringify({ playerId, guessed, error, points })
  });
  refreshRoom();
}

onlineActionButton.addEventListener("click", () => {
  if (localState === "ready") startOnlineChallenge();
  else if (localState === "reproducing") submitOnlineAnswer((performance.now() - localStartedAt) / 1000);
  else if (localState === "estimating") {
    const guessed = Number.parseFloat(onlineEstimateInput.value.trim().replace(",", "."));
    if (Number.isFinite(guessed) && guessed > 0 && guessed <= 30) submitOnlineAnswer(guessed);
    else onlineEstimateInput.classList.add("invalid");
  }
});
onlineEstimateInput.addEventListener("keydown", event => {
  if (event.key === "Enter") onlineActionButton.click();
});
document.addEventListener("keydown", event => {
  if (selectedMode !== "online" || duelArena.classList.contains("hidden") || event.code !== "Space" || event.repeat || document.activeElement === onlineEstimateInput) return;
  event.preventDefault();
  if (!nextOnlineRoundButton.classList.contains("hidden")) nextOnlineRoundButton.click();
  else if (!onlineActionButton.disabled) onlineActionButton.click();
});
createRoomButton.addEventListener("click", createRoom);
joinRoomButton.addEventListener("click", joinRoom);
startDuelButton.addEventListener("click", launchDuel);
copyCodeButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(roomCode);
  roomMessage.textContent = "Code copié. Envoie-le à ton adversaire.";
});
nextOnlineRoundButton.addEventListener("click", async () => {
  if (!isHost) return;
  if (roomData.currentRound >= 4) {
    await request("", { method: "PATCH", body: JSON.stringify({ status: "finished" }) });
    onlineConsoleCopy.textContent = "Duel terminé. Recharge le salon pour une revanche.";
    nextOnlineRoundButton.classList.add("hidden");
    return;
  }
  await request("", { method: "PATCH", body: JSON.stringify({ currentRound: roomData.currentRound + 1 }) });
  refreshRoom();
});

window.enterOnlineMode = () => {
  consolePanel.classList.add("hidden");
  resultPanel.classList.add("hidden");
  onlinePanel.classList.remove("hidden");
  firebaseWarning.classList.toggle("hidden", firebaseReady());
  createRoomButton.disabled = !firebaseReady();
  joinRoomButton.disabled = !firebaseReady();
  if (!roomCode) showOnlineView("entry");
};

window.leaveOnlineMode = () => {
  onlinePanel.classList.add("hidden");
  clearInterval(pollTimer);
};
