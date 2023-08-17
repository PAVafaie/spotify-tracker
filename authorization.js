require('dotenv').config();

const express = require('express');
const session = require('express-session');
const axios = require('axios');
const SpotifyWebApi = require('spotify-web-api-js');
const crypto = require('crypto');
const querystring = require('querystring');


const app = express();
const port = 3000;

// Used for authorization
const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = "http://localhost:3000/callback";

const sessionSecret = crypto.randomBytes(32).toString('hex');

const spotifyApi = new SpotifyWebApi();

/*
    1. User logs in
    2. Redirect to callback
    3. Callback uri handles response from spotify that has authorization code
    4. Use this to request access token

    5. Need to refresh token as it expires
*/

// Configure session middleware (for cookies)
// for now just using session to store oauth state 
app.use(
    session({
        secret: sessionSecret,
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false }, // Set secure to true for production with HTTPS
    })
);

app.get('/login', async (req, res) => {
    
    var state = crypto.randomBytes(20).toString('hex');
    var scope = 'user-read-private user-read-email';

    req.session.state = state;

    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: clientId,
            scope: scope,
            redirect_uri: redirectUri,
            state: state
        })
    );
});

app.get('/callback', async function(req, res) {

    var code = req.query.code || null;
    var state = req.query.state || null;

    const storedState = req.session.state;

    if (state === null || state !== storedState)  {
        res.redirect('/#' +
            querystring.stringify({
            error: 'state_mismatch'
        }));
    } else {
        const authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            method: 'post',
            data: querystring.stringify({
                code: code,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            }),
            headers: {
                'Authorization': 'Basic ' + (new Buffer.from(clientId + ':' + clientSecret).toString('base64')),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            json: true
        };

        // POST to exchange code for token
        try {
            const response = await axios(authOptions);
            const access_token = response.data.access_token;
            const refresh_token = response.data.refresh_token;

            // Store access_token and refresh_token in the session
            req.session.access_token = access_token;
            req.session.refresh_token = refresh_token;

            // TODO: change
            res.redirect('/landingpage');
        } catch (error) {
            console.error('Error exchanging code for access token:', error);
            res.redirect('/#' + querystring.stringify({ error: 'access_token_error' }));
        }
    }
});

// TODO: figure out how to trigger this when needed
app.get('/refresh_token', async function(req, res) {
    const refresh_token = req.session.refresh_token;

    if (!refresh_token) {
        return res.status(400).send('No refresh token found');
    }

    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        method: 'post',
        data: querystring.stringify({
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        }),
        headers: {
            'Authorization': 'Basic ' + (new Buffer.from(clientId + ':' + clientSecret).toString('base64')),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        json: true
    };

    try {
        const response = await axios(authOptions);
        const new_access_token = response.data.access_token;
        const new_refresh_token = response.data.refresh_token;

        // Update the tokens in the session
        req.session.access_token = new_access_token;
        if (new_refresh_token) {
            req.session.refresh_token = new_refresh_token;
        }

        res.send({ 'access_token': new_access_token });
    } catch (error) {
        console.error('Error refreshing access token:', error);
        res.status(500).send('Error refreshing access token');
    }
});

app.get('/landingpage', (req, res) => {
    const accessToken = req.session.access_token;
    const refreshToken = req.session.refresh_token;

    if (!accessToken || !refreshToken) {
        return res.status(400).json({ error: 'Tokens not found' });
    }

    res.json({ access_token: accessToken, refresh_token: refreshToken });
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});