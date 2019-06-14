/*******************
 * Library Imports *
 *******************/

require('dotenv').config();
const pad = require('pad');
const colors = require('chalk');
const TwitchJS = require('twitch-js').default;
const player = require('play-sound')(opts = {});


/*****************
 * Configuration *
 *****************/

const preferences = {
    channel: 'saltyteemo',
    chatRoomIDs: {
        saltyteemo: '50815446',
        botcommands: '9df7f32a-d7f5-4011-ba56-a81b04851102'
    },
    credentials: {
        token: `${process.env.TWITCH_PASSWORD}`,
        username: `${process.env.TWITCH_USERNAME}`
    },
    delays: {
        betting: 170,
        collect: 3600,
        botResponse: 1000
    },
    betAmount: 1000 + Math.floor(Math.random() * 9),    // Random number between 1,000 and 1,009
    alertSounds: {
        bettingStarted: 'media/teemo.mp3',
        largeBet: 'media/nani.mp3'
    },
    largeBetThresholds: {
        regular: 25000,
        massive: 200000
    }
};


/******************
 * TwitchJS Setup *
 ******************/

// Create an instance of TwitchJS.
console.clear();
console.log(colors.yellowBright('\nConnecting...'));
const { chat } = new TwitchJS({ 'username': preferences.credentials.username, 'token': preferences.credentials.token, log: { level: 0 } });

// Extend TwitchJS functionality.
chat.say = function (message) {
    setTimeout(function () {
        chat.send(`PRIVMSG #${mostRecentChannel} :${message}`);
        console.log(`[${getFormattedTime()}] <${colors.cyanBright(preferences.credentials.username)}> ${message}`)
    }, preferences.delays.botResponse)
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

let opposingTeam = '';

let myBet;

let mostRecentChannel = preferences.channel;

let commands = {
    '!test': function() {
        chat.say(mostRecentChannel, `@${preferences.credentials.username} I hear you MrDestructoid`)
    },
    collect: function() {
        chat.say(mostRecentChannel, '!farm');
        timers['!collect'] = process.hrtime()
    },
    bet: function(team, amount) {
        chat.say(mostRecentChannel, `!${team} ${amount}`);
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
function logCurrentTotals(team, mushrooms, user) {
    let seconds = '[' + process.hrtime(timers.firstBet)[0] + ' seconds]';
    let _blueMushrooms = colors.blueBright(totals.blue.mushrooms.toLocaleString());
    let _blueBets = colors.blueBright(`(${totals.blue.bets} bets)`);
    let _redMushrooms = colors.redBright(totals.red.mushrooms.toLocaleString());
    let _redBets = colors.redBright(`(${totals.red.bets} bets)`);
    let _blue = _blueMushrooms + ' ' + _blueBets;
    let _red = _redMushrooms + ' ' + _redBets;

    let _extra = '';

    // A large bet was detected.
    if (mushrooms >= preferences.largeBetThresholds.regular) {
        // Add extra text to show the large bet and the username.
        _extra = ` <--  ${Math.floor(mushrooms / 1000)}k on ${eval('colors.' + team + 'Bright(team)')} from ${user}`;

        // A very large bet was detected
        if (mushrooms >= preferences.largeBetThresholds.massive) {
            // Play audio file.
            player.play(preferences.alertSounds.largeBet, function(err) { if (err && !err.killed) throw err })
        }
    }

    console.log(pad(_blue, 34) + ' | ' + pad(pad(34, _red), 33) + pad(16, seconds) + colors.bold(_extra))
}

// Resets global betting properties and logs the time and other information.
function notifyBettingEnded() {
    console.log(colors.gray(`\n[${getFormattedTime()}] Betting has ended\n`));
    try {
        let profit = Math.floor(myBet / totals[myTeam].mushrooms * totals[opposingTeam].mushrooms);
        let gross = profit + myBet;
        profit = profit.toLocaleString();
        gross = gross.toLocaleString();

        console.log(`Your bet: !${myTeam} ${myBet}`);
        console.log(`Winnings: +${gross} mushrooms (${profit} profit)\n`);
    } catch (err) {}

    myBet = 0;
    myTeam = '';
    opposingTeam = '';
    betComplete = false;
    totals.red.bets = 0;
    totals.blue.bets = 0;
    totals.red.mushrooms = 0;
    totals.blue.mushrooms = 0
}

// Decide how much to bet and which team to bet on.
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
    opposingTeam = higher.name;
    myBet = preferences.betAmount;

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

        // Collect mushrooms after x amount of seconds.
        if (_secondsSinceCollect >= preferences.delays.collect)
            commands.collect();

        // Manually set betting to ended after x amount of seconds.
        if (_secondsSinceFirstBet >= 330 && isBettingOpen())
            notifyBettingEnded();

        // Bet on a team after x amount of seconds.
        if (_secondsSinceFirstBet >= preferences.delays.betting && !betComplete && isBettingOpen()) {
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
    // Message includes a processed bet.
    if (message.includes('Bet complete for')) {
        if (!isBettingOpen()) {
            // Record time of first bet.
            timers.firstBet = process.hrtime();

            // Play audio file.
            player.play(preferences.alertSounds.bettingStarted, function(err) { if (err && !err.killed) throw err });

            console.log(colors.greenBright(`\n[${getFormattedTime()}] Betting has started\n`))
        }

        // Parse information from message.
        const bet = message.split('Bet complete for ')[1].split('. Your new balance is')[0].toLowerCase().split(', ');
        const team = bet[0];
        const mushrooms = parseInt(bet[1]);

        // Update totals for mushrooms and bets.
        totals[team].mushrooms += mushrooms;
        totals[team].bets += 1;

        // Check which user submitted the bet.
        let betting_user = '';
        for (let word of message.split(" ")) {
            if (word.toLowerCase().includes('@'))
                betting_user = word.replace("@", "")
        }

        // Check if bet was sent by my account.
        if (betting_user.toLowerCase() === preferences.credentials.username) {
            console.log(colors.grey(`\n[${getFormattedTime()}] Bet received\n`));
            myTeam = team;
            opposingTeam = (myTeam === 'red') ? 'blue' : 'red';
            myBet = mushrooms;
            betComplete = true
        }

        logCurrentTotals(team, mushrooms, betting_user)
    }

    // Betting is over.
    if (message.includes('Betting has ended') && isBettingOpen())
        notifyBettingEnded();
}

// Handle any message sent by my own account.
function handleMyMessage(channel, username, message) {
    console.log(`[${getFormattedTime()}] <${colors.cyanBright(username)}> ${message}`);

    mostRecentChannel = channel;

    if (typeof commands[message] === 'function')
        commands[message]()
}

// Handle any message sent from any user other than those that are already handled.
function handleOtherMessage(channel, username, message) {
    // Message includes an @ mention.
    if (message.toLowerCase().includes('@' + preferences.credentials.username)) {
        let iterableMessage = message.split(" ");
        let copyMessage = '';

        for (let [index, word] of iterableMessage.entries()) {
            if (word.toLowerCase().includes('@' + preferences.credentials.username)) word = colors.whiteBright.bold(word);
            if (index > 0) copyMessage += " ";
            copyMessage += word
        }

        console.log(colors.bgRed(`[${getFormattedTime()}] <${(username)}> ${copyMessage}`))
    }
}


/*************************
 * TwitchJS Finalization *
 *************************/

// Listen for all user and bot messages.
chat.on('PRIVMSG', (msg) => {
    let params = [msg.channel.replace("#", ""), msg.username, msg.message];

    switch (msg.username) {
        case 'xxsaltbotxx':
            handleSaltbotMessage(...params); break;
        case preferences.credentials.username:
            handleMyMessage(...params); break;
        default:
            handleOtherMessage(...params)
    }
});

// Connect to IRC and join the channel.
chat.connect().then(() => {
    chat.join(preferences.channel);
    chat.join(`chatrooms:${preferences.chatRoomIDs.saltyteemo}:${preferences.chatRoomIDs.botcommands}`);
    initTimers();
    console.log(colors.greenBright('Connection established\n'));
});
