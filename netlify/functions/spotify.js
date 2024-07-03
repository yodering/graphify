const fetch = require('node-fetch');

const clientId = process.env.VITE_SPOTIFY_CLIENT_ID;
const clientSecret = process.env.VITE_SPOTIFY_CLIENT_SECRET;
const redirectUri = process.env.VITE_SPOTIFY_REDIRECT_URI;

exports.handler = async (event, context) => {
  const path = event.path.replace('/netlify/functions/spotify', '');
  const { httpMethod, body } = event;

  switch (path) {
    case '/login':
      return handleLogin();
    case '/callback':
      return handleCallback(event.queryStringParameters);
    case '/token':
      return handleToken(JSON.parse(body));
    case '/search-artist':
      return handleSearchArtist(JSON.parse(body));
    case '/artist-top-tracks':
      return handleArtistTopTracks(JSON.parse(body));
    case '/create-playlist':
      return handleCreatePlaylist(JSON.parse(body));
    case '/add-tracks-to-playlist':
      return handleAddTracksToPlaylist(JSON.parse(body));
    case '/user-profile':
      return handleUserProfile(JSON.parse(body));
    default:
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Not Found' }),
      };
  }
};

function handleLogin() {
  const scope = 'user-read-private user-read-email playlist-modify-public playlist-modify-private';
  const spotifyAuthUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  return {
    statusCode: 302,
    headers: {
      Location: spotifyAuthUrl,
    },
  };
}

async function handleCallback({ code }) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
    },
    body: new URLSearchParams({
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  const data = await response.json();

  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
}

async function handleToken({ refreshToken }) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  const data = await response.json();

  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
}

async function handleSearchArtist({ token, artistName }) {
  const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();

  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
}

async function handleArtistTopTracks({ token, artistId }) {
  const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?country=US`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();

  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
}

async function handleCreatePlaylist({ token, userId, name, description }) {
  const response = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      description,
      public: false
    })
  });

  const data = await response.json();

  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
}

async function handleAddTracksToPlaylist({ token, playlistId, uris }) {
  const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ uris })
  });

  const data = await response.json();

  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
}

async function handleUserProfile({ token }) {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();

  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
}