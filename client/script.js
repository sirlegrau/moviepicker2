const socket = io();
let playerId = null;
let currentMovie = null;
let playerName = null;
let votesRemaining = 10;

// DOM Elements
const nameModal = document.getElementById("nameModal");
const playerNameInput = document.getElementById("playerNameInput");
const submitNameBtn = document.getElementById("submitName");
const lobby = document.getElementById("lobby");
const playersInLobby = document.getElementById("playersInLobby");
const startGameBtn = document.getElementById("startGame");
const game = document.getElementById("game");
const results = document.getElementById("results");
const movieTitle = document.getElementById("movieTitle");
const moviePoster = document.getElementById("moviePoster");
const movieDescription = document.getElementById("movieDescription");
const voteYes = document.getElementById("voteYes");
const voteNo = document.getElementById("voteNo");
const votesRemainingDisplay = document.getElementById("votesRemaining");
const votingAnimation = document.getElementById("votingAnimation");
const finalRankings = document.getElementById("finalRankings");
const restartGame = document.getElementById("restartGame");
const readyBtn = document.getElementById("joinLobby");
const lobbyStatus = document.getElementById("lobbyStatus");

// Name Input
submitNameBtn.addEventListener("click", () => {
    playerName = playerNameInput.value.trim();
    if (playerName) {
        nameModal.classList.add("hidden");
        lobby.classList.remove("hidden");

        // Emit event to join/create lobby
        socket.emit("createOrJoinLobby", playerName);
    }
});


// Lobby Socket Events
socket.on("lobbyUpdated", (data) => {
    // Update players list
    playersInLobby.innerHTML = "";
    data.players.forEach(player => {
        const li = document.createElement("li");
        li.textContent = `${player.name} ${player.ready ? '✓' : ''}`;
        playersInLobby.appendChild(li);
    });

    // Update lobby status
    lobbyStatus.textContent = `${data.players.length} player(s) in lobby`;

    // Enable start button if enough players are ready
    startGameBtn.disabled = data.players.length < 2;
});

// Ready Button
readyBtn.addEventListener("click", () => {
    socket.emit("playerReady");
    readyBtn.disabled = true;
    lobbyStatus.textContent = "Waiting for other players...";
});

// Start Game Button
startGameBtn.addEventListener("click", () => {
    socket.emit("playerReady");
});

// Additional socket event to capture player ID
socket.on("playerAssigned", (id) => {
    playerId = id;
});

// Game Start
socket.on("gameStart", (gameData) => {
    lobby.classList.add("hidden");
    game.classList.remove("hidden");
    votesRemaining = 10;
    votesRemainingDisplay.textContent = `Votes Remaining: ${votesRemaining}`;
});

// Show Next Movie
socket.on("nextMovie", (data) => {
    currentMovie = data.movie;
    movieTitle.innerText = currentMovie.title;
    moviePoster.src = currentMovie.poster;
    movieDescription.innerText = currentMovie.description;

    // Reset vote buttons
    voteYes.disabled = false;
    voteNo.disabled = false;
    voteYes.textContent = `👍 Yes (${votesRemaining} votes)`;
    voteNo.textContent = `👎 No (${votesRemaining} votes)`;
});

// Voting Logic
function castVote(vote) {
    if (votesRemaining > 0) {
        socket.emit("vote", {
            playerId,
            movieId: currentMovie.id,
            vote,
            votes: votesRemaining
        });
    }
}

// Vote Buttons
voteYes.addEventListener("click", () => castVote("yes"));
voteNo.addEventListener("click", () => castVote("no"));

// Vote Update
socket.on("voteUpdate", (data) => {
    votesRemaining = data.remainingVotes;
    votesRemainingDisplay.textContent = `Votes Remaining: ${votesRemaining}`;

    // Disable buttons if no votes left
    if (votesRemaining === 0) {
        voteYes.disabled = true;
        voteNo.disabled = true;
    }
});

// Show Results
socket.on("showResults", (data) => {
    game.classList.add("hidden");
    results.classList.remove("hidden");

    // Populate ranked movies
    finalRankings.innerHTML = "";
    data.rankedMovies.forEach((movie, index) => {
        const li = document.createElement("li");
        li.innerHTML = `
            ${movie.title} 
            <span class="votes">👍 ${movie.yesVotes} | 👎 ${movie.noVotes}</span>
        `;
        finalRankings.appendChild(li);
    });

    // Create voting animation (simplified version)
    votingAnimation.innerHTML = "";
    data.rankedMovies.forEach(movie => {
        const movieDiv = document.createElement("div");
        movieDiv.classList.add("movie-vote-animation");
        movieDiv.innerHTML = `
            <h3>${movie.title}</h3>
            <div class="vote-bars">
                <div class="yes-bar" style="width: ${movie.yesVotes * 5}px">👍 ${movie.yesVotes}</div>
                <div class="no-bar" style="width: ${movie.noVotes * 5}px">👎 ${movie.noVotes}</div>
            </div>
        `;
        votingAnimation.appendChild(movieDiv);
    });
});

// Restart Game
restartGame.addEventListener("click", () => {
    socket.emit("restart");
    results.classList.add("hidden");
    lobby.classList.remove("hidden");
});

// Lobby Reset
socket.on("lobbyReset", (data) => {
    // Update players list
    playersInLobby.innerHTML = "";
    data.players.forEach(player => {
        const li = document.createElement("li");
        li.textContent = `${player.name} ${player.ready ? '✓' : ''}`;
        playersInLobby.appendChild(li);
    });
});