const battlePanel = document.getElementById("battlePanel");
const battleEntry = document.getElementById("battleEntry");
const battleLobby = document.getElementById("battleLobby");
const battleArena = document.getElementById("battleArena");
const battleRecap = document.getElementById("battleRecap");
const battleFinal = document.getElementById("battleFinal");
const battleNameInput = document.getElementById("battleNameInput");
const battleCodeInput = document.getElementById("battleCodeInput");
const createBattleButton = document.getElementById("createBattleButton");
const joinBattleButton = document.getElementById("joinBattleButton");
const battleMessage = document.getElementById("battleMessage");
const battleCodeDisplay = document.getElementById("battleCodeDisplay");
const battlePlayerCount = document.getElementById("battlePlayerCount");
const battlePlayerList = document.getElementById("battlePlayerList");
const copyBattleCodeButton = document.getElementById("copyBattleCodeButton");
const startBattleButton = document.getElementById("startBattleButton");
const battleLobbyMessage = document.getElementById("battleLobbyMessage");
const battleStage = document.getElementById("battleStage");
const battleRound = document.getElementById("battleRound");
const battleAlive = document.getElementById("battleAlive");
const battleStatus = document.getElementById("battleStatus");
const battleSignalLight = document.getElementById("battleSignalLight");
const battleStatusLabel = document.getElementById("battleStatusLabel");
const battleTimer = document.getElementById("battleTimer");
const battleEstimateBox = document.getElementById("battleEstimateBox");
const battleEstimateInput = document.getElementById("battleEstimateInput");
const battleConsoleCopy = document.getElementById("battleConsoleCopy");
const battleActionButton = document.getElementById("battleActionButton");
const battleButtonIcon = document.getElementById("battleButtonIcon");
const battleButtonText = document.getElementById("battleButtonText");
const battleWaitingResult = document.getElementById("battleWaitingResult");
const resolveBattleButton = document.getElementById("resolveBattleButton");
const battleRecapTitle = document.getElementById("battleRecapTitle");
const battleRank = document.getElementById("battleRank");
const battleRankDetail = document.getElementById("battleRankDetail");
const battleRecapStats = document.getElementById("battleRecapStats");
const battleRanking = document.getElementById("battleRanking");
const nextBattleRoundButton = document.getElementById("nextBattleRoundButton");
const battleRecapWait = document.getElementById("battleRecapWait");
const battleFinalTitle = document.getElementById("battleFinalTitle");
const battleFinalCopy = document.getElementById("battleFinalCopy");
const battleWinner = document.getElementById("battleWinner");
const battleFinalRanking = document.getElementById("battleFinalRanking");
const battleRematchButton = document.getElementById("battleRematchButton");
const battleFinalWait = document.getElementById("battleFinalWait");

const battleDatabaseURL = (window.TEMPO_HEIST_FIREBASE?.databaseURL || "").replace(/\/$/, "");
const battlePlayerId = sessionStorage.getItem("tempoHeistBattlePlayer") || crypto.randomUUID();
sessionStorage.setItem("tempoHeistBattlePlayer", battlePlayerId);

let battleRoomCode = "";
let battleRoomData = null;
let battleIsHost = false;
let battlePollTimer = null;
let battleLocalRound = -1;
let battleLocalState = "waiting";
let battleStartedAt = 0;
let battleSignalTimeout = null;

function battleRoomUrl(path = "") {
  return `${battleDatabaseURL}/tempo-heist/battleRooms/${battleRoomCode}${path}.json`;
}

async function battleRequest(path = "", options = {}) {
  if (!battleDatabaseURL) throw new Error("Add the Firebase URL to firebase-config.js.");
  const response = await fetch(battleRoomUrl(path), {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) throw new Error(`Firebase returned ${response.status}. Check the database rules.`);
  return response.json();
}

function battleName() {
  return (battleNameInput.value.trim() || "AGENT 07").slice(0, 14).toUpperCase();
}

function battleCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function battleChallenge() {
  return {
    challenge: Math.random() < .5 ? "reproduce" : "estimate",
    target: Math.round((2.25 + Math.random() * 6.5) * 100) / 100
  };
}

function battlePlayers() {
  return battleRoomData?.players ? Object.entries(battleRoomData.players) : [];
}

function activeBattlePlayers() {
  return battlePlayers().filter(([, player]) => !player.eliminated);
}

function ownBattlePlayer() {
  return battleRoomData?.players?.[battlePlayerId];
}

function currentBattleStage() {
  return battleRoomData?.currentStage || 0;
}

function battleAnswerKey(stage = currentBattleStage(), round = battleRoomData?.currentRound || 0) {
  return `${stage}-${round}`;
}

function battleStageAnswers(player, stage = currentBattleStage()) {
  return Array.from({ length: 5 }, (_, round) => player.answers?.[battleAnswerKey(stage, round)]);
}

function battleStageError(player, stage = currentBattleStage()) {
  return battleStageAnswers(player, stage).reduce((total, answer) => total + (answer?.error ?? 999), 0);
}

function battleStageProgress(player, stage = currentBattleStage()) {
  const answers = battleStageAnswers(player, stage).filter(Boolean);
  return {
    answered: answers.length,
    error: answers.reduce((total, answer) => total + answer.error, 0)
  };
}

function battleLiveRankings() {
  return activeBattlePlayers().map(([id, player]) => ({
    id,
    name: player.name,
    ...battleStageProgress(player)
  })).sort((a, b) => a.error - b.error || b.answered - a.answered || a.name.localeCompare(b.name));
}

function renderBattleSpectatorBoard(answerKey) {
  const rankings = battleLiveRankings();
  const leaderError = rankings[0]?.error || 0;
  if (!rankings.length) return "No active agents remain.";
  return `
    <strong>SPECTATOR LIVE BOARD</strong>
    <span>${rankings.filter(entry => battleRoomData.players?.[entry.id]?.answers?.[answerKey]).length} / ${rankings.length} active agents locked this round.</span>
    <div class="battle-ranking spectator-ranking">
      ${rankings.slice(0, 12).map((entry, index) => {
        const gap = entry.error - leaderError;
        return `<div><b>#${String(index + 1).padStart(2, "0")}</b><span>${escapeHtml(entry.name)}</span><small>${formatSeconds(entry.error)} S · ${entry.answered}/5</small><em>+${formatSeconds(gap)} S</em></div>`;
      }).join("")}
    </div>`;
}

function showBattleView(view) {
  battleEntry.classList.toggle("hidden", view !== "entry");
  battleLobby.classList.toggle("hidden", view !== "lobby");
  battleArena.classList.toggle("hidden", view !== "arena");
  battleRecap.classList.toggle("hidden", view !== "recap");
  battleFinal.classList.toggle("hidden", view !== "final");
  if (view !== "recap") {
    nextBattleRoundButton.classList.add("hidden");
    battleRecapWait.classList.add("hidden");
  }
}

function setBattleButton(text, icon = "♛", disabled = false) {
  battleButtonText.textContent = text;
  battleButtonIcon.textContent = icon;
  battleActionButton.disabled = disabled;
}

function renderBattleTime(value) {
  const [seconds, centis] = value.toFixed(2).split(".");
  battleTimer.innerHTML = `<span>00</span><i>:</i><span>${seconds}</span><i>.</i><small>${centis}</small>`;
  battleTimer.classList.remove("blind");
}

function renderBattleHidden() {
  battleTimer.innerHTML = "<span>••</span><i>:</i><span>••</span><i>.</i><small>••</small>";
  battleTimer.classList.add("blind");
}

function renderBattleLobby() {
  const players = battlePlayers();
  battleCodeDisplay.textContent = battleRoomCode;
  battlePlayerCount.textContent = players.length;
  battlePlayerList.innerHTML = players.slice(0, 100).map(([id, player], index) =>
    `<div><b>${String(index + 1).padStart(2, "0")}</b><span>${escapeHtml(player.name)}</span><small>${id === battleRoomData.hostId ? "HOST" : "READY"}</small></div>`
  ).join("");
  startBattleButton.classList.toggle("hidden", !battleIsHost);
  startBattleButton.disabled = !battleIsHost || players.length < 2;
  battleLobbyMessage.textContent = players.length < 2 ? "Waiting for at least one more agent..." : `${players.length} agents ready to infiltrate.`;
}

function renderBattleArena() {
  const roundData = battleRoomData.round;
  const player = ownBattlePlayer();
  const active = activeBattlePlayers();
  const answerKey = battleAnswerKey();
  const ownAnswer = player?.answers?.[answerKey];
  const answeredCount = active.filter(([, activePlayer]) => activePlayer.answers?.[answerKey]).length;

  showBattleView("arena");
  battleStage.textContent = String(currentBattleStage() + 1).padStart(2, "0");
  battleRound.textContent = String(battleRoomData.currentRound + 1).padStart(2, "0");
  battleAlive.textContent = active.length;
  battleStatus.textContent = player?.eliminated ? "ELIMINATED" : "ACTIVE";
  resolveBattleButton.innerHTML = battleRoomData.currentRound >= 4 ? "RESOLVE STAGE <b>→</b>" : "NEXT ROUND <b>→</b>";
  resolveBattleButton.classList.toggle("hidden", !battleIsHost || answeredCount < active.length || active.length === 0);

  if (player?.eliminated) {
    battleLocalState = "spectating";
    battleStatusLabel.textContent = "SPECTATOR MODE";
    battleConsoleCopy.textContent = "You are eliminated, but the live board follows every surviving agent.";
    renderBattleHidden();
    setBattleButton("ELIMINATED", "×", true);
    battleWaitingResult.classList.remove("hidden");
    battleWaitingResult.innerHTML = renderBattleSpectatorBoard(answerKey);
    return;
  }

  if (battleLocalRound === battleRoomData.currentRound) {
    if (ownAnswer) {
      battleLocalState = "submitted";
      battleStatusLabel.textContent = "ANSWER LOCKED";
      battleConsoleCopy.textContent = `${answeredCount} / ${active.length} active agents have answered.`;
      setBattleButton("WAITING FOR AGENTS", "✓", true);
      battleWaitingResult.classList.remove("hidden");
      battleWaitingResult.innerHTML = `Your answer: <b>${formatSeconds(ownAnswer.guessed)} S</b> · round error ${formatSeconds(ownAnswer.error)} S`;
    }
    return;
  }

  clearTimeout(battleSignalTimeout);
  battleLocalRound = battleRoomData.currentRound;
  battleLocalState = "ready";
  battleSignalLight.classList.remove("on");
  battleEstimateBox.classList.add("hidden");
  battleEstimateInput.value = "";
  battleWaitingResult.classList.add("hidden");

  if (roundData.challenge === "reproduce") {
    battleStatusLabel.textContent = "BATTLE / REPRODUCE";
    renderBattleTime(roundData.target);
    battleConsoleCopy.textContent = "Memorize the target. Start your invisible clock when ready.";
    setBattleButton("START MY CLOCK", "⌖");
  } else {
    battleStatusLabel.textContent = "BATTLE / ESTIMATE";
    renderBattleHidden();
    battleConsoleCopy.textContent = "Activate the signal when ready. Every active agent sees the same duration.";
    setBattleButton("ACTIVATE MY SIGNAL", "✦");
  }
}

function battleRoundRankings() {
  return Array.isArray(battleRoomData.rankings) ? battleRoomData.rankings : Object.values(battleRoomData.rankings || {});
}

function renderBattleRecap() {
  const rankings = battleRoundRankings();
  const player = ownBattlePlayer();
  const ownRank = rankings.find(entry => entry.id === battlePlayerId);
  const alive = activeBattlePlayers().length;
  const eliminatedCount = rankings.filter(entry => entry.eliminated).length;

  showBattleView("recap");
  battleRecapTitle.textContent = player?.eliminated ? "YOU WERE ELIMINATED" : "YOU SURVIVED";
  battleRank.textContent = ownRank ? `#${String(ownRank.rank).padStart(2, "0")}` : "SPECTATOR";
  battleRankDetail.textContent = ownRank ? `${formatSeconds(ownRank.error)} S TOTAL ERROR / 5 ROUNDS` : "NO ANSWER";
  battleRecapStats.innerHTML = `
    <div><span>AGENTS SURVIVING</span><strong>${alive}</strong></div>
    <div><span>ELIMINATED THIS STAGE</span><strong>${eliminatedCount}</strong></div>
    <div><span>NEXT CUT</span><strong>~30%</strong></div>`;
  battleRanking.innerHTML = rankings.slice(0, 12).map(entry =>
    `<div class="${entry.eliminated ? "eliminated" : ""}"><b>#${String(entry.rank).padStart(2, "0")}</b><span>${escapeHtml(entry.name)}</span><small>${formatSeconds(entry.error)} S</small><em>${entry.eliminated ? "OUT" : "SAFE"}</em></div>`
  ).join("");
  nextBattleRoundButton.classList.toggle("hidden", !battleIsHost);
  battleRecapWait.classList.toggle("hidden", battleIsHost);
}

function finalBattlePlayers() {
  return battlePlayers().sort(([, a], [, b]) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    return (b.eliminatedStage ?? 999) - (a.eliminatedStage ?? 999);
  });
}

function renderBattleFinal() {
  const players = finalBattlePlayers();
  const winner = players.find(([, player]) => !player.eliminated);
  const ownWon = winner?.[0] === battlePlayerId;
  showBattleView("final");
  battleFinalTitle.textContent = ownWon ? "YOU ARE THE LAST AGENT" : "LAST AGENT STANDING";
  battleFinalCopy.textContent = ownWon ? "The Azure Diamond is yours." : `${winner?.[1]?.name || "An agent"} claimed the Azure Diamond.`;
  battleWinner.innerHTML = winner
    ? `<span>WINNER</span><strong>${escapeHtml(winner[1].name)}</strong><small>SURVIVED ${currentBattleStage() + 1} ${currentBattleStage() === 0 ? "STAGE" : "STAGES"}</small>`
    : "<strong>NO WINNER</strong>";
  battleFinalRanking.innerHTML = players.slice(0, 20).map(([id, player], index) =>
    `<div><b>#${String(index + 1).padStart(2, "0")}</b><span>${escapeHtml(player.name)}</span><small>${id === winner?.[0] ? "WINNER" : `OUT STAGE ${(player.eliminatedStage ?? 0) + 1}`}</small></div>`
  ).join("");
  battleRematchButton.classList.toggle("hidden", !battleIsHost);
  battleFinalWait.classList.toggle("hidden", battleIsHost);
}

async function refreshBattleRoom() {
  try {
    const data = await battleRequest();
    if (!data) throw new Error("This battle room no longer exists.");
    battleRoomData = data;
    if (data.status === "lobby") {
      showBattleView("lobby");
      renderBattleLobby();
    } else if (data.status === "playing") {
      renderBattleArena();
    } else if (data.status === "recap") {
      renderBattleRecap();
    } else if (data.status === "finished") {
      renderBattleFinal();
    }
  } catch (error) {
    battleMessage.textContent = error.message;
    battleLobbyMessage.textContent = error.message;
  }
}

function startBattlePolling() {
  clearInterval(battlePollTimer);
  refreshBattleRoom();
  battlePollTimer = setInterval(refreshBattleRoom, 1300);
}

async function createBattle() {
  try {
    battleMessage.textContent = "";
    battleRoomCode = battleCode();
    battleIsHost = true;
    const room = {
      hostId: battlePlayerId,
      status: "lobby",
      currentStage: 0,
      currentRound: 0,
      eliminationRate: .3,
      createdAt: Date.now(),
      players: {
        [battlePlayerId]: { name: battleName(), eliminated: false, answers: {} }
      }
    };
    await battleRequest("", { method: "PUT", body: JSON.stringify(room) });
    startBattlePolling();
  } catch (error) {
    battleMessage.textContent = error.message;
  }
}

async function joinBattle() {
  try {
    battleMessage.textContent = "";
    battleRoomCode = battleCodeInput.value.trim().toUpperCase();
    if (battleRoomCode.length !== 5) throw new Error("Enter a five-character battle code.");
    const room = await battleRequest();
    if (!room) throw new Error("Battle room not found.");
    if (room.status !== "lobby") throw new Error("This battle has already started.");
    if (Object.keys(room.players || {}).length >= 100) throw new Error("This battle is already full.");
    battleIsHost = false;
    await battleRequest(`/players/${battlePlayerId}`, {
      method: "PUT",
      body: JSON.stringify({ name: battleName(), eliminated: false, answers: {} })
    });
    startBattlePolling();
  } catch (error) {
    battleMessage.textContent = error.message;
  }
}

async function launchBattle() {
  if (!battleIsHost || battlePlayers().length < 2) return;
  battleLocalRound = -1;
  await battleRequest("", {
    method: "PATCH",
    body: JSON.stringify({ status: "playing", currentStage: 0, currentRound: 0, round: battleChallenge(), rankings: null })
  });
  refreshBattleRoom();
}

function startBattleChallenge() {
  const roundData = battleRoomData.round;
  if (roundData.challenge === "reproduce") {
    battleLocalState = "reproducing";
    battleStartedAt = performance.now();
    renderBattleHidden();
    battleStatusLabel.textContent = "INVISIBLE CLOCK / RUNNING";
    battleConsoleCopy.textContent = "Stop your clock at the exact moment.";
    setBattleButton("STOP MY CLOCK", "✦");
    return;
  }

  battleLocalState = "signal";
  battleSignalLight.classList.add("on");
  battleStatusLabel.textContent = "LIGHT SIGNAL / OBSERVE";
  battleConsoleCopy.textContent = "The light will turn off by itself. Feel its duration.";
  setBattleButton("SIGNAL RUNNING", "✦", true);
  battleSignalTimeout = setTimeout(() => {
    battleLocalState = "estimating";
    battleSignalLight.classList.remove("on");
    battleEstimateBox.classList.remove("hidden");
    battleEstimateInput.focus();
    battleStatusLabel.textContent = "SIGNAL OFF / YOUR TURN";
    battleConsoleCopy.textContent = "How long was the light on?";
    setBattleButton("CONFIRM MY ESTIMATE", "✓");
  }, roundData.target * 1000);
}

async function submitBattleAnswer(guessed) {
  const error = Math.abs(guessed - battleRoomData.round.target);
  battleLocalState = "submitted";
  await battleRequest(`/players/${battlePlayerId}/answers/${battleAnswerKey()}`, {
    method: "PUT",
    body: JSON.stringify({ guessed, error })
  });
  refreshBattleRoom();
}

async function resolveBattleRound() {
  if (!battleIsHost) return;
  if (battleRoomData.currentRound < 4) {
    battleLocalRound = -1;
    await battleRequest("", {
      method: "PATCH",
      body: JSON.stringify({
        currentRound: battleRoomData.currentRound + 1,
        round: battleChallenge()
      })
    });
    refreshBattleRoom();
    return;
  }

  const active = activeBattlePlayers();
  const ranked = active.map(([id, player]) => ({
    id,
    name: player.name,
    error: battleStageError(player)
  })).sort((a, b) => a.error - b.error);
  const eliminateCount = ranked.length <= 1 ? 0 : Math.min(ranked.length - 1, Math.max(1, Math.ceil(ranked.length * (battleRoomData.eliminationRate || .3))));
  const cutoff = ranked.length - eliminateCount;
  const rankings = ranked.map((entry, index) => ({ ...entry, rank: index + 1, eliminated: index >= cutoff }));
  const playerUpdates = {};
  rankings.filter(entry => entry.eliminated).forEach(entry => {
    playerUpdates[`players/${entry.id}/eliminated`] = true;
    playerUpdates[`players/${entry.id}/eliminatedStage`] = currentBattleStage();
  });
  await battleRequest("", {
    method: "PATCH",
    body: JSON.stringify({ status: "recap", rankings, ...playerUpdates })
  });
  refreshBattleRoom();
}

async function nextBattleRound() {
  if (!battleIsHost) return;
  const survivors = activeBattlePlayers();
  if (survivors.length <= 1) {
    await battleRequest("", { method: "PATCH", body: JSON.stringify({ status: "finished" }) });
    refreshBattleRoom();
    return;
  }
  battleLocalRound = -1;
  await battleRequest("", {
    method: "PATCH",
    body: JSON.stringify({
      status: "playing",
      currentStage: currentBattleStage() + 1,
      currentRound: 0,
      round: battleChallenge(),
      rankings: null
    })
  });
  refreshBattleRoom();
}

battleActionButton.addEventListener("click", () => {
  if (battleLocalState === "ready") startBattleChallenge();
  else if (battleLocalState === "reproducing") submitBattleAnswer((performance.now() - battleStartedAt) / 1000);
  else if (battleLocalState === "estimating") {
    const guessed = Number.parseFloat(battleEstimateInput.value.trim().replace(",", "."));
    if (Number.isFinite(guessed) && guessed > 0 && guessed <= 30) submitBattleAnswer(guessed);
    else battleEstimateInput.classList.add("invalid");
  }
});
battleEstimateInput.addEventListener("keydown", event => {
  if (event.key === "Enter") battleActionButton.click();
});
document.addEventListener("keydown", event => {
  if (selectedMode !== "battle" || event.code !== "Space" || event.repeat || document.activeElement === battleEstimateInput) return;
  event.preventDefault();
  if (!battleRecap.classList.contains("hidden") && !nextBattleRoundButton.classList.contains("hidden")) nextBattleRoundButton.click();
  else if (!battleArena.classList.contains("hidden") && !resolveBattleButton.classList.contains("hidden")) resolveBattleButton.click();
  else if (!battleArena.classList.contains("hidden") && !battleActionButton.disabled) battleActionButton.click();
});
createBattleButton.addEventListener("click", createBattle);
joinBattleButton.addEventListener("click", joinBattle);
copyBattleCodeButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(battleRoomCode);
  battleLobbyMessage.textContent = "Code copied. Share it with the other agents.";
});
startBattleButton.addEventListener("click", launchBattle);
resolveBattleButton.addEventListener("click", resolveBattleRound);
nextBattleRoundButton.addEventListener("click", nextBattleRound);
battleRematchButton.addEventListener("click", async () => {
  if (!battleIsHost) return;
  battleLocalRound = -1;
  const resetPlayers = Object.fromEntries(battlePlayers().map(([id, player]) => [id, { name: player.name, eliminated: false, answers: {} }]));
  await battleRequest("", {
    method: "PATCH",
    body: JSON.stringify({ status: "lobby", currentStage: 0, currentRound: 0, round: null, rankings: null, players: resetPlayers })
  });
  refreshBattleRoom();
});

window.enterBattleMode = () => {
  consolePanel.classList.add("hidden");
  resultPanel.classList.add("hidden");
  onlinePanel.classList.add("hidden");
  battlePanel.classList.remove("hidden");
  createBattleButton.disabled = !battleDatabaseURL;
  joinBattleButton.disabled = !battleDatabaseURL;
  if (!battleRoomCode) showBattleView("entry");
  else startBattlePolling();
};

window.leaveBattleMode = () => {
  battlePanel.classList.add("hidden");
  clearInterval(battlePollTimer);
};
