let artistSongsMap = {};
let svg;
let selectedNode = null;
let offset = {x: 0, y: 0};
let nodeIdCounter = 0;
let displayedSongsMap = {};
let userAccessToken;

document.addEventListener('DOMContentLoaded', function () {
    initializeUI();
    handleAuthRedirect();
});

function initializeUI() {
    svg = document.getElementById('graph');
    document.getElementById('loginButton').addEventListener('click', spotifyLogin);
    document.getElementById('shuffleButton').addEventListener('click', shuffleSongs);
    document.getElementById('savePlaylistButton').addEventListener('click', savePlaylistToSpotify);
    
    setupPlaylistNameInput();
    setupMenuEventListeners();
    createCentralNode();
    openHelpMenu();
}

function setupPlaylistNameInput() {
    const playlistNameInput = document.getElementById('playlistNameInput');
    const playlistHeader = document.querySelector('#playlistContainer h1');
    
    playlistNameInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            updatePlaylistName();
        }
    });
    
    playlistNameInput.addEventListener('blur', updatePlaylistName);
    
    function updatePlaylistName() {
        const playlistName = playlistNameInput.value.trim();
        if (playlistName) {
            playlistHeader.textContent = playlistName;
        }
    }
}

function setupMenuEventListeners() {
    document.querySelector(".playlist-space").addEventListener('click', toggleSidebar);
    document.getElementById("x").addEventListener('click', toggleSidebar);
    document.querySelector(".question-mark-space").addEventListener('click', toggleHelpMenu);
    document.querySelector(".user-space").addEventListener('click', toggleAccountMenu);
    document.querySelector(".artist-space").addEventListener('click', toggleArtistMenu);
}

function createCentralNode() {
    createNode(window.innerWidth / 2, window.innerHeight / 2, true);
}

function openHelpMenu() {
    const helpMenu = document.getElementById('help-menu');
    helpMenu.classList.add('visible');
}

function spotifyLogin() {
    window.location.href = '/netlify/functions/spotify/login';
}

async function handleAuthRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
        try {
            const response = await fetch('/netlify/functions/spotify/callback?code=' + code);
            const data = await response.json();
            userAccessToken = data.access_token;
            if (userAccessToken) {
                fetchUserProfile();
            }
        } catch (error) {
            console.error('Error exchanging code for token:', error);
        }
    }
}

async function fetchUserProfile() {
    try {
        const response = await fetch('/netlify/functions/spotify/user-profile', {
            method: 'POST',
            body: JSON.stringify({ token: userAccessToken })
        });
        const userData = await response.json();
        displayUserProfile(userData);
    } catch (error) {
        console.error('Error fetching user profile:', error);
    }
}

function displayUserProfile(userData) {
    const userNameElement = document.getElementById('user-name');
    const userImageElement = document.getElementById('user-image');

    userNameElement.textContent = userData.display_name || 'Spotify User';

    if (userData.images && userData.images.length > 0) {
        userImageElement.src = userData.images[0].url;
        userImageElement.style.display = 'block';
    } else {
        userImageElement.style.display = 'none';
    }
}

function createLine(x1, y1, x2, y2) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.classList.add("line");
    line.setAttribute('id', 'line-' + nodeIdCounter);
    nodeIdCounter++;
    svg.insertBefore(line, svg.firstChild);
    return line;
}

function createNode(x, y, isCentral) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", isCentral ? 70 : 50);
    circle.classList.add("node");
    if (isCentral) {
        circle.setAttribute('id', 'central-node');
    }
    svg.appendChild(circle);

    if (!isCentral) {
        const line = createLine(x, y, window.innerWidth / 2, window.innerHeight / 2);
        circle.setAttribute('data-line', line.id);
    }

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x);
    text.setAttribute("y", y);
    text.setAttribute("dy", "0.35em");
    text.classList.add("node-text");
    svg.appendChild(text);

    circle.addEventListener('contextmenu', function(event) {
        showContextMenu(event.pageX, event.pageY, circle, event);
    });

    circle.setAttribute('data-node-id', 'node-' + nodeIdCounter);
    nodeIdCounter++;

    return { circle, text };
}

svg.addEventListener('dblclick', function (event) {
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (!event.target.classList.contains('node')) {
        if (nodeIdCounter < 15) {
            const newNode = createNode(x, y, false);
            nodeDoubleClick(newNode);
        } else {
            alert("Maximum of 15 nodes reached.");
        }
    }
});

async function nodeDoubleClick({ circle, text }) {
    const svgRect = svg.getBoundingClientRect();
    const x = parseFloat(circle.getAttribute('cx')) + svgRect.left;
    const y = parseFloat(circle.getAttribute('cy')) + svgRect.top;

    const input = document.createElement('input');
    input.type = 'text';
    input.style.position = 'absolute';
    input.style.left = `${x}px`;
    input.style.top = `${y}px`;
    document.body.appendChild(input);
    input.focus();

    input.setAttribute('data-for-node', circle.getAttribute('data-node-id'));

    input.addEventListener('keydown', async function(e) {
        if (e.key === 'Enter') {
            text.textContent = input.value;
            document.body.removeChild(input);

            const centralNode = document.getElementById('central-node');
            circle.setAttribute('data-visible-in-sidebar', 'true');
            const distance = calculateDistance(
                parseFloat(circle.getAttribute('cx')),
                parseFloat(circle.getAttribute('cy')),
                parseFloat(centralNode.getAttribute('cx')),
                parseFloat(centralNode.getAttribute('cy'))
            );
            const songsCount = getSongsCount(distance);

            const artistId = await handleArtistData(input.value, songsCount, circle);
            if (artistId) {
                circle.setAttribute('data-artist-id', artistId);
            }
        }
    });
}

async function handleArtistData(artistName, songsCount, circle) {
    try {
        const response = await fetch('/netlify/functions/spotify/search-artist', {
            method: 'POST',
            body: JSON.stringify({ token: userAccessToken, artistName })
        });
        const artistData = await response.json();
        const artist = artistData.artists.items[0];
        if (artist) {
            circle.setAttribute('data-artist-id', artist.id);
            if (!artistSongsMap[artistName]) {
                const tracksResponse = await fetch('/netlify/functions/spotify/artist-top-tracks', {
                    method: 'POST',
                    body: JSON.stringify({ token: userAccessToken, artistId: artist.id })
                });
                const tracksData = await tracksResponse.json();
                artistSongsMap[artistName] = tracksData.tracks;
            }
            displaySongs(artistName, songsCount);
            displayImage(userAccessToken, artist.id, artistName);
            return artist.id;
        }
    } catch (error) {
        console.error('Error handling artist data:', error);
    }
}

function startDrag(event) {
    if (event.target.classList.contains('node') && event.target.id !== 'central-node') {
        selectedNode = event.target;
        offset = getMousePosition(event);
        offset.x -= parseFloat(selectedNode.getAttribute('cx'));
        offset.y -= parseFloat(selectedNode.getAttribute('cy'));
        svg.addEventListener('mousemove', drag);
    }
}

function drag(event) {
    if (selectedNode) {
        const coord = getMousePosition(event);
        const dx = coord.x - offset.x;
        const dy = coord.y - offset.y;
        selectedNode.setAttribute('cx', dx);
        selectedNode.setAttribute('cy', dy);

        const lineId = selectedNode.getAttribute('data-line');
        if (lineId) {
            const line = document.getElementById(lineId);
            line.setAttribute('x1', dx);
            line.setAttribute('y1', dy);
        }

        const textElement = selectedNode.nextElementSibling;
        if (textElement && textElement.tagName === 'text') {
            textElement.setAttribute('x', dx);
            textElement.setAttribute('y', dy);
        }
        updateHoverColor(selectedNode);
    }
}

function endDrag() {
    if (selectedNode) {
        updateSongs(selectedNode);
        selectedNode = null;
    }
    svg.removeEventListener('mousemove', drag);
}

function getMousePosition(event) {
    const coords = svg.getScreenCTM();
    return {
        x: (event.clientX - coords.e) / coords.a,
        y: (event.clientY - coords.f) / coords.d
    };
}

svg.addEventListener('mousedown', startDrag);
svg.addEventListener('mouseup', endDrag);
svg.addEventListener('mouseleave', endDrag);

function updateSongs(node) {
    const artistName = node.nextSibling.textContent;
    if (artistName && artistSongsMap[artistName]) {
        const centralNode = document.getElementById('central-node');
        const distance = calculateDistance(
            parseFloat(node.getAttribute('cx')),
            parseFloat(node.getAttribute('cy')),
            parseFloat(centralNode.getAttribute('cx')),
            parseFloat(centralNode.getAttribute('cy'))
        );
        const songsCount = getSongsCount(distance);
        displaySongs(artistName, songsCount);
    }
}

async function displaySongs(artistName, songsCount) {
    const songListDiv = document.getElementById('songList');
    const existingArtistSongs = songListDiv.querySelectorAll(`[data-artist='${artistName}']`);
    existingArtistSongs.forEach(node => node.remove());

    const songs = artistSongsMap[artistName] || [];
    const limitedSongs = songs.slice(0, songsCount);
    displayedSongsMap[artistName] = limitedSongs;

    for (const song of limitedSongs) {
        const songItem = document.createElement('div');
        songItem.classList.add('song-item');
        songItem.dataset.artist = artistName;

        const albumArtUrl = await fetchAlbumArt(song.album.id);

        if (albumArtUrl) {
            const albumArtImg = document.createElement('img');
            albumArtImg.src = albumArtUrl;
            albumArtImg.alt = 'Album Art';
            albumArtImg.classList.add('album-art');
            songItem.appendChild(albumArtImg);
        }

        const songName = document.createElement('p');
        songName.textContent = `${song.name} (by ${artistName})`;
        songItem.appendChild(songName);

        songListDiv.appendChild(songItem);
    }
}

async function fetchAlbumArt(albumId) {
    try {
        const response = await fetch('/netlify/functions/spotify/album-art', {
            method: 'POST',
            body: JSON.stringify({ token: userAccessToken, albumId })
        });
        const data = await response.json();
        return data.albumArtUrl;
    } catch (error) {
        console.error('Error fetching album art:', error);
        return null;
    }
}

async function displayImage(token, artistId, artistName) {
    const imagesContainer = document.getElementById('imagesContainer');
    let artistImage = imagesContainer.querySelector(`#artist-image-${artistId}`);
    if (!artistImage) {
        try {
            const response = await fetch('/netlify/functions/spotify/artist-image', {
                method: 'POST',
                body: JSON.stringify({ token, artistId })
            });
            const data = await response.json();
            if (data.imageUrl) {
                artistImage = document.createElement("img");
                artistImage.src = data.imageUrl;
                artistImage.id = `artist-image-${artistId}`;
                artistImage.setAttribute('data-artist-name', artistName);
                artistImage.style.maxWidth = '100px';
                artistImage.style.maxHeight = '100px';
                imagesContainer.appendChild(artistImage);
            }
        } catch (error) {
            console.error('Error fetching artist image:', error);
        }
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('side-bar');
    sidebar.classList.toggle('slide-in');
}

function toggleHelpMenu() {
    toggleMenu('help-menu');
}

function toggleAccountMenu() {
    toggleMenu('user-menu');
}

function toggleArtistMenu() {
    toggleMenu('artist-menu');
}

function toggleMenu(menuId) {
    const menu = document.getElementById(menuId);
    if (menu.classList.contains('visible')) {
        menu.classList.remove('visible');
    } else {
        closeAllMenus();
        menu.classList.add('visible');
    }
}

function closeAllMenus() {
    const menus = document.querySelectorAll('.glass');
    menus.forEach(menu => {
        menu.classList.remove('visible');
    });
}

function updateHoverColor(node) {
    const centralNode = document.getElementById('central-node');
    const distance = calculateDistance(
        parseFloat(node.getAttribute('cx')),
        parseFloat(node.getAttribute('cy')),
        parseFloat(centralNode.getAttribute('cx')),
        parseFloat(centralNode.getAttribute('cy'))
    );
    const hoverColor = getColor(distance);
    node.style.setProperty('--hover-color', hoverColor);
}

function calculateDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function getSongsCount(distance) {
    const MAX_DISTANCE = 900;
    const MIN_DISTANCE = 200;
    const MAX_SONGS = 10;
    const MIN_SONGS = 1;

    const normalizedDistance = Math.min(distance, MAX_DISTANCE);
    const range = MAX_DISTANCE - MIN_DISTANCE;
    const interpolation = (MAX_SONGS - MIN_SONGS) * ((range - normalizedDistance) / range);
    const songsCount = Math.round(interpolation) + MIN_SONGS;

    return Math.min(Math.max(songsCount, MIN_SONGS), MAX_SONGS);
}

function showContextMenu(x, y, node, event) {
    event.preventDefault();
    const menu = document.getElementById('contextMenu');
    menu.style.display = 'block';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const deleteNodeButton = document.getElementById('deleteNode');
    deleteNodeButton.onclick = () => {
        deleteNode(node, document.getElementById('graph'));
        menu.style.display = 'none';
    };
}

function shuffleSongs() {
    for (const artistName in artistSongsMap) {
        if (artistSongsMap.hasOwnProperty(artistName)) {
            artistSongsMap[artistName] = shuffleArray(artistSongsMap[artistName]);
        }
    }
    updatePlaylist();
    showShufflePopup();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function showSavePopup(message) {
    var popup = document.getElementById('savePopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'savePopup';
        document.body.appendChild(popup);
    }
    popup.textContent = message;
    popup.style.opacity = '1';
    popup.style.display = 'block';

    setTimeout(function() {
        popup.style.opacity = '0';
    }, 3000);

    setTimeout(function() {
        popup.style.display = 'none';
    }, 4000);
}

function showShufflePopup() {
    showSavePopup('Playlist shuffled!');
}

function getColor(distance) {
    const maxDistance = 800;
    const normalizedDistance = Math.min(distance, maxDistance) / maxDistance;
    const red = Math.floor(255 * normalizedDistance);
    const green = Math.floor(255 * (1 - normalizedDistance));
    return `rgb(${red}, ${green}, 0)`;
}

// Complete the savePlaylistToSpotify function
async function savePlaylistToSpotify() {
    if (!userAccessToken) {
        alert('Please log in to Spotify first!');
        return;
    }

    try {
        const userResponse = await fetch('/netlify/functions/spotify/user-profile', {
            method: 'POST',
            body: JSON.stringify({ token: userAccessToken })
        });
        const userData = await userResponse.json();
        const userId = userData.id;

        const playlistName = document.getElementById('playlistNameInput').value || 'My New Playlist';

        const createResponse = await fetch('/netlify/functions/spotify/create-playlist', {
            method: 'POST',
            body: JSON.stringify({ 
                token: userAccessToken, 
                userId, 
                name: playlistName, 
                description: 'Created with Graphify' 
            })
        });
        const playlistData = await createResponse.json();
        const playlistId = playlistData.id;

        const trackUris = [];
        for (const songs of Object.values(displayedSongsMap)) {
            for (const song of songs) {
                trackUris.push(song.uri);
            }
        }

        await fetch('/netlify/functions/spotify/add-tracks-to-playlist', {
            method: 'POST',
            body: JSON.stringify({ token: userAccessToken, playlistId, uris: trackUris })
        });

        showSavePopup(`'${playlistName}' has been saved to your Spotify account!`);
    } catch (error) {
        console.error('Error saving playlist:', error);
        showSavePopup('There was an error saving your playlist. Please try again.');
    }
}

// Additional helper function
function deleteNode(node, svg) {
    if(node.id === 'central-node') {
        console.error('Central node cannot be deleted.');
        return;
    }
    const textElement = node.nextElementSibling;
    const artistName = textElement.textContent;
    const artistId = node.getAttribute('data-artist-id');

    if (artistSongsMap[artistName]) {
        delete artistSongsMap[artistName];
    }
    updatePlaylist();

    const imagesContainer = document.getElementById('imagesContainer');
    const artistImage = imagesContainer.querySelector(`#artist-image-${artistId}`);

    if (artistImage) {
        imagesContainer.removeChild(artistImage);
    }

    const lineId = node.getAttribute('data-line');
    if (lineId) {
        const line = svg.querySelector(`#${lineId}`);
        if (line) {
            svg.removeChild(line);
        }
    }

    if (textElement && textElement.tagName === 'text') {
        svg.removeChild(textElement);
    }
    svg.removeChild(node);

    const nodeId = node.getAttribute('data-node-id');
    const inputBox = document.querySelector(`input[data-for-node='${nodeId}']`);
    if (inputBox) {
        document.body.removeChild(inputBox);
    }
}

function updatePlaylist() {
    const songListDiv = document.getElementById('songList');
    songListDiv.innerHTML = '';

    const visibleNodes = document.querySelectorAll('.node[data-visible-in-sidebar="true"]');
    visibleNodes.forEach(node => {
        const artistName = node.nextSibling.textContent;
        const distance = calculateDistance(
            parseFloat(node.getAttribute('cx')),
            parseFloat(node.getAttribute('cy')),
            parseFloat(document.getElementById('central-node').getAttribute('cx')),
            parseFloat(document.getElementById('central-node').getAttribute('cy'))
        );

        const songsCount = getSongsCount(distance);
        displaySongs(artistName, songsCount);
    });
}

// Event listener for context menu
document.addEventListener('click', function(event) {
    const menu = document.getElementById('contextMenu');
    if (event.target !== menu) {
        menu.style.display = 'none';
    }
});