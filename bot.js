/*******************
 * Library Imports *
 *******************/

require('dotenv').config();
const pad = require('pad');
const colors = require('chalk');
const jsonfile = require('jsonfile');
const TwitchJS = require('twitch-js').default;
const player = require('play-sound')(opts = {});


/*****************
 * Configuration *
 *****************/

const preferences = {
    channels: [
        'saltyteemo',
        'chatrooms:50815446:9df7f32a-d7f5-4011-ba56-a81b04851102'
    ],
    credentials: {
        token: `${process.env.TWITCH_TOKEN}`,
        username: `${process.env.TWITCH_USERNAME}`
    },
    delays: {
        betting: 180,
        farm: 7200,
        botResponseDefault: 0
    },
    betAmount: 3000 + Math.floor(Math.random() * 5),
    fileNames: {
        bettingStartedSound: 'media/teemo.mp3',
        largeBetSound: 'media/nani.mp3',
        statisticsDB: 'data.json',
        balanceHistoryDB: 'balanceHistory.json'
    },
    largeBetThresholds: {
        regular: 30000,
        massive: 100000
    }
};


/******************
 * TwitchJS Setup *
 ******************/

// Create an instance of TwitchJS.
const { chat } = new TwitchJS({ 'username': preferences.credentials.username, 'token': preferences.credentials.token, log: { level: 0 } });

// Extend TwitchJS functionality.
chat.say = function (mostRecentChannel, message, botResponse = preferences.delays.botResponseDefault) {
    setTimeout(function () {
        chat.send(`PRIVMSG #${mostRecentChannel} :${message}`)
    }, botResponse)
};


/*********************
 * Global Properties *
 *********************/

let myBet = 2,
    myTeam = 'blue',
    opposingTeam = 'red',
    betComplete = false,
    mostRecentChannel = preferences.channels[1],
    myStats = jsonfile.readFileSync(preferences.fileNames.statisticsDB)["myStats"],
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
        chat.say(mostRecentChannel, `MrDestructoid`, 0)
    },
    "!balance": function() {
        chat.say(mostRecentChannel, `/me has ${myStats.currentBalance} mushrooms`, 0)
    },
    farm: function() {
        timers.farm = process.hrtime();
        chat.say(mostRecentChannel, '!farm')
    },
    bet: function(team, amount) {
        let _team = (team === 'blue') ? 'saltyt1Blue' : 'saltyt1Red';
        betComplete = true;
        chat.say(mostRecentChannel, `${_team} ${amount}`)
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

// Read statistics from JSON file.
function fetchJSONData() {
    let obj = jsonfile.readFileSync(preferences.fileNames.statisticsDB);
    myStats = obj["myStats"]
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
        _extra = ` <--  ${user} bet ${_largeAmount} on ${team} (balance: ${_balance} mushrooms)`;

        // A very large bet was detected.
        if (mushrooms >= preferences.largeBetThresholds.massive) {
            // Play audio file.
            player.play(preferences.fileNames.largeBetSound, function(err) { if (err && !err.killed) throw err });

            // Inform chat that a large bet happened.
            chat.say(preferences.channels[1],'/me ************ LARGE BET ************ ' + _extra.replace(' <--  ', ''))
        }
    }

    console.log(pad(_blue, 34) + ' | ' + pad(pad(34, _red), 33) + pad(16, seconds) + colors.bold(_extra))
}

// Resets global betting properties and logs the time and other information.
function notifyBettingEnded() {
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
    totals.blue.mushrooms = 0;

    console.log(colors.gray(`\n[${getFormattedTime()}] Betting has ended\n`))
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
    myBet = preferences.betAmount;

    // If the odds are close, bet on blue.
    if (lower.mushrooms / higher.mushrooms > 0.80) {
        myTeam = blue;
        opposingTeam = red
    }

    // If the odds are close, lower my bet amount accordingly.
    if (myBet > lower.mushrooms)
        myBet = lower.mushrooms;
    else if (myBet > higher.mushrooms - lower.mushrooms)
        myBet = higher.mushrooms - lower.mushrooms;
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
            myTeam = team;
            opposingTeam = (myTeam === 'red') ? 'blue' : 'red';
            myBet = mushrooms;
            betComplete = true;

            // Record my latest balance.
            fetchJSONData();
            myStats.previousBalance = myStats.currentBalance;
            myStats.currentBalance = balance;

            // Record whether the previous game was a win or loss.
            let _baseMsg = colors.grey('Previous game was a');
            let _winLossMsg = '';
            if (myStats.currentBalance - myStats.previousBalance > 1) {
                _winLossMsg = colors.greenBright('WIN');
                myStats.wins += 1
            } else {
                _winLossMsg = colors.redBright('LOSS');
                myStats.losses += 1
            }
            updateJSONData();

            console.log(colors.grey(`\n[${getFormattedTime()}] Bet received\n`));
            console.log(`${_baseMsg} ${_winLossMsg}`)
        }

        logCurrentTotals(team, mushrooms, betting_user, message);
    }

    // Betting is over.
    if (message.includes('Betting has ended') && isBettingOpen())
        notifyBettingEnded()
}

// Handle any message sent by my own account.
function handleMyMessage(channel, username, message) {
    mostRecentChannel = channel;

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
        console.clear();
        console.log(colors.greenBright('Connection established\n'))
    });