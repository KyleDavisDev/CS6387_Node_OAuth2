require('dotenv').config();
const express = require('express');
var session = require('express-session')
const cookieParser = require('cookie-parser');
const path = require('path');
const axios = require("axios");

const app = express();

// session setup
app.use(session({
  secret: 'this-is-not-meant-for-production',
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
    },
  resave: false
}));
app.use(cookieParser());

// Mustache setup
const mustacheExpress = require('mustache-express');
app.engine('mustache', mustacheExpress());
app.set('view engine', 'mustache');
app.use(express.static(path.join(__dirname + '/common/assets')));
app.set('views', __dirname + '/common/views');

app.get('/', (req, res) => {

  // Create the authorization link
  const oktaDomain = process.env.OKTADOMAIN;
  const clientId = process.env.CLIENT_ID
  const redirectUri = process.env.REDIRECT_URI;
  const authorizationLink = `${oktaDomain}/v1/authorize?client_id=${clientId}&response_type=code&scope=openid&redirect_uri=${redirectUri}&state=state-296bc9a0-a2a2-4a57-be1a-d0e2fd9bb601`;

  const isLoggedIn = !!req.session.accessToken;
  res.render('home', {
    isLoggedIn,
    loginRedirect: authorizationLink
  });

});

// This will get called from OKTA's server along with a code in the url
app.get("/authorization-code/callback", async (req, res) => {

  // This code value is good for 300 seconds
  const { code } = req.query;
  if(!code) {
    // If no code, we should throw some type of error and leave.
    console.error("big problem!")
    return;
  }

  const oktaDomain = process.env.OKTADOMAIN;
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const redirectUri = process.env.REDIRECT_URI;
  const data = `grant_type=authorization_code&redirect_uri=${redirectUri}&code=${code}`;
  const authToken = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const authTokenUri = `${oktaDomain}/v1/token`;

  try {
    // make POST request to OKTA server
    const result = await axios.post(authTokenUri,
        data,
        {
          headers: {
            authorization: `Basic ${authToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            accept: 'application/json'
          }
        });

    // We now have an Access token! Woohoo!
    const { access_token } = result.data;

    // save the token to session.
    req.session.accessToken = access_token;

    res.render('home', {
      isLoggedIn: true,
      loginRedirect: ''
    });

  } catch (e) {
    console.log(e)
  }
})

app.get("/logout", (req, res) => {
  // this effectively logs the person out.
  req.session.accessToken = null;

  // redirect to the base page
  res.redirect('/');
})

// start the server!
app.listen("8080", () => {
  console.log(`Listening on 8080`)
})

module.exports = app;
