/**
 *  Chub Bot
 *
 *  This version of bot.js handles:
 *      - submitting bets
 *      - farming mushrooms
 *      - sounding alerts
 *      - responding to chuby1tubby in chat
 */

/*******************
 * Library Imports *
 *******************/

require('dotenv').config();
const pad = require('pad');
const _ = require('lodash');
const colors = require('chalk');
const jsonfile = require('jsonfile');
const TwitchJS = require('twitch-js').default;
const player = require('play-sound')(opts = {});


/*****************
 * Configuration *
 *****************/

let preferences = {
    channels: [
        'saltyteemo',
        // #rules discontinued on 2019-10-13.
        //'chatrooms:50815446:9df7f32a-d7f5-4011-ba56-a81b04851102'
        'chuby1tubby'
    ],
    credentials: {
        token: `${process.env.TWITCH_PASSWORD}`,
        username: `${process.env.TWITCH_USERNAME}`
    },
    delays: {
        betting: 178,
        farm: 7200,
        botResponseDefault: 0
    },
    betAmount: 200,
    betMultiplier: 0.0075,
    fileNames: {
        bettingStartedSound: 'media/teemo.mp3',
        largeBetSound: 'media/nani.mp3',
        statisticsDB: 'data.json',
        cardsAPI: 'cards.json'
    },
    largeBetThresholds: {
        regular: 30000,
        massive: 75000
    },
    mute: false
};


/******************
 * TwitchJS Setup *
 ******************/

// Create an instance of TwitchJS.
const { chat } = new TwitchJS({
    username: preferences.credentials.username,
    token: preferences.credentials.token,
    log: { level: 0 }
});


/*********************
 * Global Properties *
 *********************/

let myBet = 101,
    myTeam = 'blue',
    opposingTeam = 'red',
    betComplete = false,
    mostRecentChannel = preferences.channels[1],
    myStats = jsonfile.readFileSync(preferences.fileNames.statisticsDB)["myStats"],
    cardsAPI = jsonfile.readFileSync(preferences.fileNames.cardsAPI),
    totals = {
        blue: {
            mushrooms: 0,
            bets: 0
        },
        red: {
            mushrooms: 0,
            bets: 0
        }
    },
    timers = {
        firstBet: process.hrtime(),
        farm: process.hrtime()
    };

const commands = {
    "!test": function() {
        chat.say('MrDestructoid', mostRecentChannel)
    },
    "!card": function() {
        const blackCard = _.sample(cardsAPI['blackCards']);

        let blackText = blackCard['text'],
            blanks = blackCard['pick'];

        if (blanks <= 1 && !blackText.includes("_")) {
            let whiteText = _.sample(cardsAPI['whiteCards']);

            chat.say(blackText, preferences.channels[1]);
            chat.say(whiteText, preferences.channels[1]);
        } else {
            let message = blackText;

            for (let i = 1; i <= blanks; i++) {
                let whiteText = _.sample(cardsAPI['whiteCards']).replace('.', '');
                whiteText = whiteText.charAt(0).toLowerCase() + whiteText.slice(1);
                message = message.replace('_', whiteText);
            }
            chat.say(message, preferences.channels[1])
        }
    },
    "!blue": function() {
        setBettingValues();
        commands.bet('blue', myBet)
    },
    "saltyt1Blue": function() {
        setBettingValues();
        commands.bet('blue', myBet)
    },
    "!red": function() {
        setBettingValues();
        commands.bet('red', myBet)
    },
    "saltyt1Red": function() {
        setBettingValues();
        commands.bet('red', myBet)
    },
    farm: function() {
        timers.farm = process.hrtime();
        chat.say('!farm', preferences.channels[0])
    },
    bet: function(team, amount) {
        let _team = (team === 'blue') ? 'saltyt1Blue' : 'saltyt1Red';
        betComplete = true;
        chat.say(`${_team} ${amount}`, preferences.channels[0])
    }
};


/*************
 * Functions *
 *************/

// Extends TwitchJS functionality.
chat.say = limiter((msg, channel) => {
    chat.send(`PRIVMSG #${channel} :${msg}`)
}, 1500);

// Returns the current time as a string, formatted with hours, minutes, seconds, and period. (ex: '[2:47:10 AM]')
function getFormattedTime() {
    return new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true })
}

// Returns the current state of betting as a boolean.
function isBettingOpen() {
    return (totals.blue.mushrooms > 0 || totals.red.mushrooms > 0)
}

// Read statistics from JSON file.
function fetchJSONData() {
    let obj = jsonfile.readFileSync(preferences.fileNames.statisticsDB);
    myStats = obj["myStats"];
    preferences.betAmount = Math.floor(myStats.currentBalance * preferences.betMultiplier)
}

// Write statistics to JSON file.
function updateJSONData() {
    jsonfile.writeFileSync(preferences.fileNames.statisticsDB, {"myStats": myStats})
}

// Logs the current time with the total mushrooms and bets for each team.
function logCurrentTotals(team, mushrooms, user, message) {
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
        let _balance = parseInt(message.split('Your new balance is ')[1].replace('.', '')).toLocaleString();
        let _thousands = Math.floor(mushrooms / 1000);
        let _largeAmount = '';

        if (_thousands >= 1000)
            _largeAmount = `${(_thousands / 1000)} MILLION`;
        else
            _largeAmount = `${_thousands}k`;

        // Add extra text to show the large bet and the username.
        _extra = ` <--  <${user}> ${team} ${_largeAmount} (balance: ${_balance} mushrooms)`;

        // A very large bet was detected.
        if (mushrooms >= preferences.largeBetThresholds.massive) {
            // Play audio file.
            if (!preferences.mute)
                player.play(preferences.fileNames.largeBetSound, function(err) { if (err && !err.killed) throw err });
        }
    }

    console.log(pad(_blue, 34) + ' | ' + pad(pad(34, _red), 33) + pad(16, seconds) + colors.bold(_extra))
}

// Resets global betting properties and logs the time and other information.
function notifyBettingEnded() {
    let profit = Math.floor(myBet / totals[myTeam].mushrooms * totals[opposingTeam].mushrooms);
    let gross = profit + myBet;
    profit = profit.toLocaleString();
    gross = gross.toLocaleString();

    console.log(colors.gray(`\n[${getFormattedTime()}] Betting has ended\n`));

    // Log personal stats after betting ends.
    console.log(`Your bet: !${myTeam} ${myBet}`);
    console.log(`Winnings: +${gross} mushrooms (${profit} profit)\n`);

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
function setBettingValues() {
    let higher = {};
    let lower = {};
    let blue = totals.blue;
    let red = totals.red;
    blue.name = 'blue';
    red.name = 'red';

    // Check which team is in the lead.
    if (red.mushrooms > blue.mushrooms) {
        higher = red;
        lower = blue
    } else {
        higher = blue;
        lower = red
    }

    // Determine team to bet on.
    myTeam = lower.name;
    opposingTeam = higher.name;

    // Determine amount to bet.
    fetchJSONData();
    myBet = preferences.betAmount;

    // If the bet is too small.
    if (myBet < 100)
        myBet = 1000;

    // If the odds are close, bet on blue.
    if (lower.mushrooms / higher.mushrooms > 0.80) {
        myTeam = blue;
        opposingTeam = red
    }

    // If the odds are close, lower my bet amount accordingly.
    if (myBet > lower.mushrooms || myBet > higher.mushrooms - lower.mushrooms)
        myBet = Math.ceil(myBet / 2);

    // Finally, if the bet would bring my balance below 'x' shrooms, reduce the bet amount.
    const minBalance = 1000000;
    const maxBet = myStats.currentBalance - minBalance;
    if (myBet > maxBet)
        myBet = maxBet
}

// Create a queue of `fn` calls and execute them in order after `wait` milliseconds.
function limiter(fn, wait) {
    let isCalled = false,
        calls = [];

    let caller = function() {
        if (calls.length && !isCalled) {
            isCalled = true;
            calls.shift().call();
            setTimeout(function() {
                isCalled = false;
                caller()
            }, wait)
        }
    };

    return function() {
        calls.push(fn.bind(this, ...arguments));
        caller()
    }
}

// Once per second, check on the sate of the timers.
setInterval(() => {
    let _secondsSinceFarm = process.hrtime(timers.farm)[0];
    let _secondsSinceFirstBet = process.hrtime(timers.firstBet)[0];

    // Farm mushrooms after x amount of seconds.
    if (_secondsSinceFarm >= preferences.delays.farm)
        commands.farm();

    // Manually set betting to ended after x amount of seconds.
    if (_secondsSinceFirstBet >= 330 && isBettingOpen())
        notifyBettingEnded();

    // Bet on a team after x amount of seconds.
    if (_secondsSinceFirstBet >= preferences.delays.betting && !betComplete && isBettingOpen()) {
        setBettingValues();
        commands.bet(myTeam, myBet)
    }
}, 1000);


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
            if (!preferences.mute)
                player.play(preferences.fileNames.bettingStartedSound, function(err) { if (err && !err.killed) throw err });

            console.log(colors.greenBright(`\n[${getFormattedTime()}] Betting has started\n`))
        }

        // Parse information from message.
        const bet = message.split('Bet complete for ')[1].split('. Your new balance is')[0].toLowerCase().split(', ');
        const balance = parseInt(message.split('Your new balance is ')[1].replace('.', ''));
        const team = bet[0];
        const mushrooms = parseInt(bet[1]);

        // Update totals for mushrooms and bets.
        totals[team].mushrooms += mushrooms;
        totals[team].bets += 1;

        // Check which user submitted the bet.
        let betting_user = '';
        for (let word of message.split(" "))
            if (word.toLowerCase().includes('@'))
                betting_user = word.replace('@', '');

        // Check if bet was sent by my account.
        if (message.toLowerCase().includes(preferences.credentials.username)) {
            // Update global properties.
            myTeam = team.toLowerCase();
            opposingTeam = (myTeam === 'red') ? 'blue' : 'red';
            myBet = mushrooms;
            preferences.betAmount = myBet;
            betComplete = true;

            // Record my latest balance.
            fetchJSONData();
            myStats.previousBalance = myStats.currentBalance;
            myStats.currentBalance = balance;
            updateJSONData();

            console.log(colors.grey(`\n[${getFormattedTime()}] Bet received\n`))
        }

        logCurrentTotals(team, mushrooms, betting_user, message)
    }

    // Betting is over.
    if (message.includes('Betting has ended') && isBettingOpen())
        notifyBettingEnded()
}

// Handle any message sent by my own account.
function handleMyMessage(channel, username, message) {
    if (typeof commands[message] === 'function')
        commands[message]();

    console.log(`[${getFormattedTime()}] <${colors.cyanBright(username)}> ${message}`)
}

// Handle any message sent from any user other than those that are already handled.
function handleOtherMessage(channel, username, message, isWhisper=false) {
    // Message includes an @ mention.
    if (message.toLowerCase().includes('@' + preferences.credentials.username) || isWhisper) {
        let iterableMessage = message.split(" ");
        let _message = '';

        for (let [index, word] of iterableMessage.entries()) {
            if (word.toLowerCase().includes('@' + preferences.credentials.username))
                word = colors.whiteBright.bold(word);
            if (index > 0)
                _message += " ";
            _message += word
        }

        console.log(colors.bgRed(`[${getFormattedTime()}] <${(username)}> ${_message}`))
    }

    // Message is the cards against humanity command.
    if (message === "!card" && channel === preferences.channels[1])
        commands["!card"]()
}


/*************************
 * TwitchJS Finalization *
 *************************/

// Listen for all user and bot messages.
chat.on('PRIVMSG', (msg) => {
    let params = [msg.channel.replace("#", ""), msg.username, msg.message];

    // Listen for specific users and bots.
    switch (msg.username) {
        case 'xxsaltbotxx':
            handleSaltbotMessage(...params); break;
        case preferences.credentials.username:
            handleMyMessage(...params); break;
        default:
            handleOtherMessage(...params)
    }
});

// Listen for all whispers.
chat.on('WHISPER', (msg) => {
    handleOtherMessage(msg.channel.replace("#", ""), msg.username, msg.message, true)
});

// Connect to IRC.
chat.connect()
    .then(() => {
        // Join channels.
        for (const channel of preferences.channels)
            chat.join(channel);

        fetchJSONData();

        console.clear();
        console.log(colors.greenBright('Connection established\n'))
    });
