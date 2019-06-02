# NodeJS Twitch IRC bot for SaltyTeemo
A simple IRC bot for the SaltyTeemo livestream on Twitch built with Node.JS

### Getting Started
Clone this repository: `git clone https://github.com/knakamura13/node-js-twitch-irc-bot-for-saltyteemo twitch-bot-js && cd twitch-bot-js`
 
Install NodeJS for your system: https://nodejs.org/en/download/

Install the project dependencies: `npm install`
* Dependencies used in this project:
    * "chalk": "^2.4.2"
    * "dotenv": "^8.0.0"
    * "play-sound": "^1.1.3"
    * "twitch-js": "^1.2.17"

Open the `.env` file and modify the `TWITCH_USERNAME` and `TWITCH_PASSWORD` placeholder values
* Your username should be all lowercase; i.e. `SaltyTeemo` should be written as `saltyteemo`
* You can get your password (API key) from http://twitchapps.com/tmi/

Run the app: `npm start` OR `node bot.js`
