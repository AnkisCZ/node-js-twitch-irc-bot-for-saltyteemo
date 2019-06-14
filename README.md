# NodeJS Twitch IRC bot for SaltyTeemo
A simple IRC bot for the SaltyTeemo livestream on Twitch built with Node.JS

### Getting Started
Clone this repository: `git clone https://github.com/knakamura13/node-js-twitch-irc-bot-for-saltyteemo twitch-bot-js && cd twitch-bot-js`
 
Install NodeJS for your system: https://nodejs.org/en/download/

Install the project dependencies: `npm install`
* Dependencies used in this project:
    * "pad": "^3.2.0"
    * "chalk": "^2.4.2"
    * "dotenv": "^8.0.0"
    * "twitch-js": "^2.0.0-beta.30"
    * "play-sound": "^1.1.3"

Open the `.env` file and add the following two lines,
replacing the placeholders with your credentials:
```
TWITCH_USERNAME=yourusername
TWITCH_PASSWORD=yourpassword
```
* The file is probably hidden on your system. Use the command line/Terminal to open the file:
    * Windows: `Notepad .env`
    * MacOS: `open .env`
* Your username should be all lowercase; i.e. `SaltyTeemo` should be written as `saltyteemo`
* You can get your password (API key) from http://twitchapps.com/tmi/

Run the app: `npm start` OR `node bot.js`
