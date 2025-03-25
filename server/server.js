const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the client folder
app.use(express.static(path.join(__dirname, "../client")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../client", "index.html"));
});

// Game state
let lobbies = [];
const MAX_PLAYERS = 5;
const TOTAL_VOTES_PER_PLAYER = 10;

const moviesPool = [
    { id: 1, title: "Inception", poster: "https://via.placeholder.com/200x300", description: "Sci-fi thriller" },
    { id: 2, title: "The Matrix", poster: "https://via.placeholder.com/200x300", description: "Virtual reality sci-fi" },
    { id: 3, title: "Titanic", poster: "https://via.placeholder.com/200x300", description: "Romantic tragedy" },
    { id: 4, title: "The Godfather", poster: "https://via.placeholder.com/200x300", description: "Mafia classic" },
    { id: 5, title: "The Shawshank Redemption", poster: "https://via.placeholder.com/200x300", description: "Prison drama masterpiece" },
    { id: 6, title: "Pulp Fiction", poster: "https://via.placeholder.com/200x300", description: "Tarantino's iconic film" }
];

io.on("connection", (socket) => {
    console.log("A player connected:", socket.id);

    socket.on("createOrJoinLobby", (playerName) => {
        // Assign player ID and send back to client
        socket.emit("playerAssigned", socket.id);

        // Find an available lobby or create a new one
        let availableLobby = lobbies.find(lobby => lobby.players.length < MAX_PLAYERS && !lobby.gameStarted);

        if (!availableLobby) {
            availableLobby = {
                id: Date.now(),
                players: [],
                gameStarted: false,
                votes: {},
                playerVotes: {},
                selectedMovies: [],
                currentRound: 0
            };
            lobbies.push(availableLobby);
        }

        // Add player to lobby
        const player = {
            id: socket.id,
            name: playerName,
            votesRemaining: TOTAL_VOTES_PER_PLAYER,
            ready: false
        };
        availableLobby.players.push(player);

        // Update player's socket lobby
        socket.lobbyId = availableLobby.id;
        socket.join(availableLobby.id);  // Join socket.io room

        // Emit updated lobby info to all players in this lobby
        io.to(availableLobby.id).emit("lobbyUpdated", {
            players: availableLobby.players.map(p => ({
                id: p.id,
                name: p.name,
                ready: p.ready
            }))
        });
    });

    socket.on("playerReady", () => {
        const lobby = lobbies.find(l => l.id === socket.lobbyId);
        if (lobby) {
            const player = lobby.players.find(p => p.id === socket.id);
            if (player) {
                player.ready = true;

                // Check if all players are ready and there are at least 2 players
                const allReady = lobby.players.length >= 2 &&
                    lobby.players.every(p => p.ready);

                if (allReady) {
                    startGame(lobby);
                }
            }
        }
    });

    function startGame(lobby) {
        lobby.gameStarted = true;
        lobby.selectedMovies = moviesPool.sort(() => 0.5 - Math.random()).slice(0, 5);
        lobby.votes = {};
        lobby.playerVotes = {};
        lobby.currentRound = 0;

        io.to(lobby.id).emit("gameStart", {
            movies: lobby.selectedMovies,
            players: lobby.players.map(p => ({ id: p.id, name: p.name }))
        });

        sendNextMovie(lobby);
    }

    function sendNextMovie(lobby) {
        if (lobby.currentRound < lobby.selectedMovies.length) {
            io.to(lobby.id).emit("nextMovie", {
                movie: lobby.selectedMovies[lobby.currentRound],
                remainingMovies: lobby.selectedMovies.length - lobby.currentRound
            });
            lobby.playerVotes = {}; // Reset voting tracker for the round
        } else {
            showResults(lobby);
        }
    }

    socket.on("vote", ({ playerId, movieId, vote, votes }) => {
        const lobby = lobbies.find(l => l.id === socket.lobbyId);
        if (!lobby) return;

        const player = lobby.players.find(p => p.id === playerId);
        if (!player || player.votesRemaining < votes) return;

        if (!lobby.votes[movieId]) {
            lobby.votes[movieId] = { yesVotes: 0, noVotes: 0 };
        }

        lobby.votes[movieId][vote + "Votes"] += votes;
        player.votesRemaining -= votes;

        lobby.playerVotes[playerId] = true;

        // If all players have voted, move to next round
        if (Object.keys(lobby.playerVotes).length === lobby.players.length) {
            lobby.currentRound++;
            setTimeout(() => sendNextMovie(lobby), 1000);
        }

        // Emit vote update
        io.to(lobby.id).emit("voteUpdate", {
            playerId,
            movieId,
            vote,
            votes,
            remainingVotes: player.votesRemaining
        });
    });

    function showResults(lobby) {
        // Sort movies by votes
        const rankedMovies = lobby.selectedMovies.map(movie => ({
            ...movie,
            yesVotes: lobby.votes[movie.id]?.yesVotes || 0,
            noVotes: lobby.votes[movie.id]?.noVotes || 0
        })).sort((a, b) => (b.yesVotes - b.noVotes) - (a.yesVotes - a.noVotes));

        io.to(lobby.id).emit("showResults", {
            rankedMovies,
            playerVotes: lobby.votes
        });
    }

    socket.on("restart", () => {
        const lobby = lobbies.find(l => l.id === socket.lobbyId);
        if (lobby) {
            lobby.gameStarted = false;
            lobby.players.forEach(p => {
                p.ready = false;
                p.votesRemaining = TOTAL_VOTES_PER_PLAYER;
            });

            io.to(lobby.id).emit("lobbyReset", {
                players: lobby.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    ready: p.ready
                }))
            });
        }
    });

    socket.on("disconnect", () => {
        // Remove player from lobby
        lobbies.forEach(lobby => {
            lobby.players = lobby.players.filter(p => p.id !== socket.id);

            // If lobby becomes empty, remove it
            if (lobby.players.length === 0) {
                lobbies = lobbies.filter(l => l !== lobby);
            }
        });
    });
});

server.listen(3000, () => console.log("Server running on http://localhost:3000"));