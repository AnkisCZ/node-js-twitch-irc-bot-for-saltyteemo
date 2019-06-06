// MARK: Library Imports & Setup

const log = console.log;
const player = require('play-sound')(opts = {});
const colors = require('chalk');
const dotenv = require('dotenv');
dotenv.config();


// MARK: TwitchJS Setup

// Import TwitchJS.
const TwitchJS = require('twitch-js').default;

// Set connection options.
const channel = 'saltyteemo';
const oAuthToken = process.env.TWITCH_PASSWORD;
const oAuthUsername = process.env.TWITCH_USERNAME;

// Create an instance of TwitchJS.
const { chat } = new TwitchJS({ 'username': oAuthUsername, 'token': oAuthToken });

// Extend TwitchJS functionality.
chat.say = function (message) {
    setTimeout(function () {
        chat.send(`PRIVMSG #${channel} :${message}`)
    }, 1000)
};


// MARK: Global Properties

let totals = {
    'blue': {
        'mushrooms': 0,
        'bets': 0,
    },
    'red': {
        'mushrooms': 0,
        'bets': 0,
    },
};

let timers = {
    'firstBet': process.hrtime(),
    '!collect': process.hrtime(),
};

let betComplete = false;

let myTeam = '';

let myBet;

let commands = {
    '!test': function() {
        chat.say(`@${oAuthUsername} I hear you MrDestructoid`)
    },
    '!catfact': function() {
        chat.say(`@${oAuthUsername} Sorry, I'm all out of cat facts`);
    },
    collect: function() {
        chat.say('!collect');
        timers['!collect'] = process.hrtime();
    },
    bet: function(team, amount) {
        chat.say(`!${team} ${amount}`);
        betComplete = true;
    }
};


// MARK: General Functions

// Reset global properties when betting is over.
function notifyBettingEnded() {
    totals.blue.mushrooms = 0;
    totals.red.mushrooms = 0;
    totals.blue.bets = 0;
    totals.red.bets = 0;
    betComplete = false;
    log(colors.gray('Betting has ended\n'));
}

function isBettingOpen() {
    return (totals.blue.mushrooms > 0 || totals.red.mushrooms > 0)
}

// Once per second, check how long betting has been open.
setInterval(() => {
    // 180 seconds since betting started.
    if (process.hrtime(timers.firstBet)[0] > 180 && !betComplete && isBettingOpen()) {
        // Check which team is in the lead.
        let higher = {};
        let lower = {};
        let blue = totals.blue;
        let red = totals.red;
        blue.name = 'blue';
        red.name = 'red';

        if (red.mushrooms > blue.mushrooms) {
            higher = red;
            lower = blue;
        } else {
            higher = blue;
            lower = red;
        }

        myTeam = lower.name;
        myBet = 6000 + Math.floor(Math.random() * 10);

        if (myBet > lower.mushrooms) {
            myBet = lower.mushrooms;
        } else if (higher.mushrooms - lower.mushrooms < 1000) {
            myBet = 1000 + Math.floor(Math.random() * 10);
        } else if (higher.mushrooms - lower.mushrooms < 5000) {
            myBet = 3000 + Math.floor(Math.random() * 10);
        }

        commands.bet(myTeam, myBet);
    }

    // 60 minutes since last !collect.
    if (process.hrtime(timers['!collect'])[0] > 3600) {
        commands.collect();
    }

    // Betting has been open for over 4 minutes.
    if (process.hrtime(timers.firstBet)[0] > 240 && isBettingOpen()) {
        notifyBettingEnded();
    }
}, 1000);


// MARK: Message Handling Functions

// Handle any message sent by Saltbot.
function handleSaltbotMessage(channel, username, message) {
    // Message contains a processed bet.
    if (message.includes('Bet complete for')) {
        // First bet of the game.
        if (!isBettingOpen()) {
            // Record time of first bet.
            timers.firstBet = process.hrtime();

            // Play audio file.
            player.play('teemo.mp3', function(err) {
                if (err && !err.killed) throw err;
            });
        }

        // Parse information from message.
        const bet = message.split('Bet complete for ')[1].split('. Your new balance is')[0].toLowerCase().split(', ');
        const team = bet[0];
        const mushrooms = parseInt(bet[1]);

        // Update totals for mushrooms and bets.
        totals[team].mushrooms += mushrooms;
        totals[team].bets += 1;

        let seconds = process.hrtime(timers.firstBet)[0];
        let _blueTotal = colors.blueBright(totals.blue.mushrooms.toLocaleString());
        let _redTotal = colors.redBright(totals.red.mushrooms.toLocaleString());

        log(`Betting open (${seconds} s)`);
        log(`${_blueTotal} | ${_redTotal}\n`);
    }

    // Betting is over.
    if (message.includes('Betting has ended') && isBettingOpen()) {
        notifyBettingEnded();
    }
}

// Handle any message sent by my own account.
function handleMyMessage(channel, username, message) {
    log(`<${colors.cyanBright(username)}> ${message}`);

    if (typeof commands.message === 'function') {
        commands.message()
    }
}

// Delegate all messages to other message handling functions.
function delegateMessage(msg) {
    switch (msg.username) {
        case 'xxsaltbotxx':
            handleSaltbotMessage(channel, msg.username, msg.message);
            break;
        case oAuthUsername:
            handleMyMessage(channel, msg.username, msg.message);
            break;
        default:
            break;
    }
}


// MARK: TwitchJS Events and Methods

// Listen for all user and bot messages.
chat.on('PRIVMSG', delegateMessage);

// Connect to IRC and join the channel.
chat.connect().then(() => {
    chat.join(channel);
});