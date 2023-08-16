require('dotenv').config();

const express = require('express');
const SpotifyWebApi = require('spotify-web-api-js');

const app = express();
const port = 3000;

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
