/*******************
 * Library Imports *
 *******************/

require('dotenv').config();
const colors = require('chalk');
const TwitchJS = require('twitch-js').default;
const player = require('play-sound')(opts = {});


/******************
 * TwitchJS Setup *
 ******************/

const channel = 'saltyteemo';
const oAuthToken = `${process.env.TWITCH_PASSWORD}`;
const oAuthUsername = `${process.env.TWITCH_USERNAME}`;

if (oAuthUsername.length < 4 || oAuthUsername.length > 25)
    throw colors.red(`TwitchUsernameException: Invalid Twitch username: '${oAuthUsername}'\n`);
if (oAuthToken.length < 36)
    throw colors.red(`TwitchTokenException: Invalid Twitch token: '${oAuthToken}'\n`);

// Create an instance of TwitchJS.
const { chat } = new TwitchJS({ 'username': oAuthUsername, 'token': oAuthToken });

// Extend TwitchJS functionality.
chat.say = function (message) {
    setTimeout(function () {
        chat.send(`PRIVMSG #${channel} :${message}`);
        console.log(`[${getFormattedTime()}] <${colors.cyanBright(oAuthUsername)}> ${message}`)
    }, 1000)
};


/*********************
 * Global Properties *
 *********************/

let totals = {
    'blue': {
        'mushrooms': 0,
        'bets': 0
    },
    'red': {
        'mushrooms': 0,
        'bets': 0
    }
};

let timers = {
    'firstBet': process.hrtime(),
    '!collect': process.hrtime()
};

let betComplete = false;

let myTeam = '';

let myBet;

let commands = {
    '!test': function() {
        chat.say(`@${oAuthUsername} I hear you MrDestructoid`)
    },
    '!catfact': function() {
        chat.say(`@${oAuthUsername} Sorry, I'm all out of cat facts`)
    },
    collect: function() {
        chat.say('!collect');
        timers['!collect'] = process.hrtime()
    },
    bet: function(team, amount) {
        chat.say(`!${team} ${amount}`);
        betComplete = true
    }
};


/*********************
 * General Functions *
 *********************/

// Returns the current time as a string, formatted with hours, minutes, seconds, and period. (ex: '[2:47:10 AM]')
function getFormattedTime() {
    return new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true })
}

// Returns the current state of betting as a boolean.
function isBettingOpen() {
    return (totals.blue.mushrooms > 0 || totals.red.mushrooms > 0)
}

// Logs the current time with the total mushrooms and bets for each team.
function logCurrentTotals() {
    let seconds = process.hrtime(timers.firstBet)[0];
    let _blueMushrooms = colors.blueBright(totals.blue.mushrooms.toLocaleString());
    let _redMushrooms = colors.redBright(totals.red.mushrooms.toLocaleString());
    let _blueBets = colors.blueBright(`(${totals.blue.bets} bets)`);
    let _redBets = colors.redBright(`(${totals.red.bets} bets)`);
    console.log(`[${seconds}s] ${_blueMushrooms} (${_blueBets} bets) | ${_redMushrooms} (${_redBets} bets)`)
}

// Resets global betting properties and logs the time.
function notifyBettingEnded() {
    totals.blue.mushrooms = 0;
    totals.red.mushrooms = 0;
    totals.blue.bets = 0;
    totals.red.bets = 0;
    betComplete = false;
    console.log(colors.gray(`\n[${getFormattedTime()}] Betting has ended\n`))
}

function calculateBet() {
    let higher = {};
    let lower = {};
    let blue = totals.blue;
    let red = totals.red;
    blue.name = 'blue';
    red.name = 'red';

    // Check which team is in the lead.
    if (red.mushrooms > blue.mushrooms) {
        higher = red;
        lower = blue;
    } else {
        higher = blue;
        lower = red;
    }

    // Determine team and amount to bet.
    myTeam = lower.name;
    myBet = 5000 + Math.floor(Math.random() * 5);

    // Check if the bet amount is needlessly high.
    if (myBet > lower.mushrooms)
        myBet = lower.mushrooms;
    else if (higher.mushrooms - lower.mushrooms < 1000)
        myBet = 1000 + Math.floor(Math.random() * 10);
    else if (higher.mushrooms - lower.mushrooms < 5000)
        myBet = 3000 + Math.floor(Math.random() * 10)
}

// Once per second, check on the sate of the timers.
function initTimers() {
    setInterval(() => {
        let _secondsSinceCollect = process.hrtime(timers['!collect'])[0];
        let _secondsSinceFirstBet = process.hrtime(timers.firstBet)[0];

        // 60 minutes since last !collect.
        if (_secondsSinceCollect > 3600)
            commands.collect();

        // 4 minutes since betting started.
        if (_secondsSinceFirstBet > 240 && isBettingOpen())
            notifyBettingEnded();

        // 3 minutes since betting started.
        if (_secondsSinceFirstBet > 180 && !betComplete && isBettingOpen()) {
            calculateBet();
            commands.bet(myTeam, myBet)
        }
    }, 1000)
}


/******************************
 * Message Handling Functions *
 ******************************/

// Handle any message sent by xxsaltbotxx.
function handleSaltbotMessage(channel, username, message) {
    // Message contains a processed bet.
    if (message.includes('Bet complete for')) {
        if (!isBettingOpen()) {
            // Record time of first bet.
            timers.firstBet = process.hrtime();

            // Play audio file.
            player.play('teemo.mp3', function(err) { if (err && !err.killed) throw err });

            console.log(colors.greenBright(`\n[${getFormattedTime()}] Betting has started`))
        }

        // Parse information from message.
        const bet = message.split('Bet complete for ')[1].split('. Your new balance is')[0].toLowerCase().split(', ');
        const team = bet[0];
        const mushrooms = parseInt(bet[1]);

        // Update totals for mushrooms and bets.
        totals[team].mushrooms += mushrooms;
        totals[team].bets += 1;

        logCurrentTotals()
    }

    // Betting is over.
    if (message.includes('Betting has ended') && isBettingOpen()) {
        logCurrentTotals();
        notifyBettingEnded()
    }
}

// Handle any message sent by my own account.
function handleMyMessage(channel, username, message) {
    console.log(`[${getFormattedTime()}] <${colors.cyanBright(username)}> ${message}`);

    if (typeof commands[message] === 'function')
        commands[message]()
}


/*************************
 * TwitchJS Finalization *
 *************************/

// Listen for all user and bot messages.
chat.on('PRIVMSG', (msg) => {
    let params = [channel, msg.username, msg.message];

    switch (msg.username) {
        case 'xxsaltbotxx': handleSaltbotMessage(...params); break;
        case oAuthUsername: handleMyMessage(...params)
    }
});

// Connect to IRC and join the channel.
chat.connect().then(() => {
    chat.join(channel);
    initTimers()
});