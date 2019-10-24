/*******************
 * Library Imports *
 *******************/

require('dotenv').config();
const pad = require('pad');
const colors = require('chalk');
const TwitchJS = require('twitch-js').default;


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
        token: `${process.env.TWITCH_TOKEN}`,
        username: `${process.env.TWITCH_USERNAME}`
    },
    delays: {
        botResponseDefault: 0,
        tallyUpdate: 150,
        farm: 14400
    },
    largeBetThresholds: {
        regular: 25000,
        massive: 50000
    }
};

let botState = {
    isPaused: false
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

let notifyTallySent = false,
    mostRecentChannel = preferences.channels[1],
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
        chat.say('MrDestructoid', preferences.channels[1])
    },
    "!wub": function(arg) {
        let response = "hello";

        switch(arg) {
            case "pause":
                if (botState.isPaused === true) {
                    response = "I'm already paused";
                } else {
                    response = "betting paused";
                    botState.isPaused = true
                }
                break;
            case "unpause":
                if (botState.isPaused === false) {
                    response = "I'm already unpaused";
                } else {
                    response = "betting unpaused";
                    botState.isPaused = false
                }
                break;
        }

        chat.send(`PRIVMSG #${mostRecentChannel} :/me @chuby1tubby ${response}`)
    },
    farm: function() {
        timers.farm = process.hrtime();
        chat.send(`PRIVMSG #saltyteemo :!farm`);
    }
};


/*********************
 * General Functions *
 *********************/

// Extends TwitchJS functionality.
chat.say = limiter((msg, channel) => {
    if (!botState.isPaused) {
        chat.send(`PRIVMSG #${channel} :${msg}`)
    }
}, 1500);

// Returns the current time as a string, formatted with hours, minutes, seconds, and period. (ex: '[2:47:10 AM]')
function getFormattedTime() {
    return new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true })
}

// Returns the current state of betting as a boolean.
function isBettingOpen() {
    return (totals.blue.mushrooms > 0 || totals.red.mushrooms > 0)
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
            // Inform chat that a large bet happened.
            chat.say('/me PogChamp PogChamp LARGE BET PogChamp PogChamp ' + _extra.replace(' <--  ', '').replace('blue', 'Blue').replace('red', 'Red'), preferences.channels[1])
        }
    }

    console.log(pad(_blue, 34) + ' | ' + pad(pad(34, _red), 33) + pad(16, seconds) + colors.bold(_extra))
}

// Resets global betting properties and logs the time and other information.
function notifyBettingEnded() {
    totals.red.bets = 0;
    totals.blue.bets = 0;
    notifyTallySent = false;
    totals.red.mushrooms = 0;
    totals.blue.mushrooms = 0;

    console.log(colors.gray(`[${getFormattedTime()}] Betting has ended\n`))
}

function notifyOneHundredSecondTally() {
    let _blueThousands = Math.floor(totals.blue.mushrooms / 1000);
    let _redThousands = Math.floor(totals.red.mushrooms / 1000);
    let _blueAmount = '';
    let _redAmount = '';

    if (_blueThousands >= 1000)
        _blueAmount = `${(_blueThousands / 1000)} MILLION`;
    else
        _blueAmount = `${_blueThousands}k`;

    if (_redThousands >= 1000)
        _redAmount = `${(_redThousands / 1000)} MILLION`;
    else
        _redAmount = `${_redThousands}k`;

    // Set a mathematical symbol representing which team is in the lead.
    let _comparisonSymbol = '=';
    if (_blueThousands > _redThousands)
        _comparisonSymbol = '>';
    else if (_blueThousands < _redThousands)
        _comparisonSymbol = '<';

    // Add extra text to show the large bet and the username.
    chat.say(`/me GivePLZ GivePLZ 2.5 MIN UPDATE TakeNRG TakeNRG Blue ${_blueAmount} ${_comparisonSymbol} ${_redAmount} Red`, preferences.channels[1])
    console.log(`2 MINUTE UPDATE Blue ${_blueAmount} ${_comparisonSymbol} ${_redAmount} Red`);
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

    // Notify blue vs. red tally.
    if (_secondsSinceFirstBet >= preferences.delays.tallyUpdate && !notifyTallySent && isBettingOpen()) {
        notifyOneHundredSecondTally();
        notifyTallySent = true
    }

    // Manually set betting to ended after x amount of seconds.
    if (_secondsSinceFirstBet >= 330 && isBettingOpen())
        notifyBettingEnded();
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

    const messageSplit = message.split(" ");
    const cmd = messageSplit[0];
    const arg = messageSplit[1];

    if (typeof commands[cmd] === 'function')
        commands[cmd](arg);

    console.log(`[${getFormattedTime()}] <${colors.cyanBright(username)}> ${message}`)

    if (message.toLowerCase() === `@${preferences.credentials.username}`) {
        chat.say(`VoHiYo`, preferences.channels[1]);
    }
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

    if (message.toLowerCase() === `@${preferences.credentials.username}`) {
        chat.say(`DansGame`, preferences.channels[1]);
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
        case 'chuby1tubby':
            handleMyMessage(...params); break;
        default:
            handleOtherMessage(...params)
    }
});

// Connect to IRC.
chat.connect()
    .then(() => {
        // Join channels.
        for (const channel of preferences.channels)
            chat.join(channel);
        console.clear();
        console.log(colors.greenBright('Connection established\n'));
    });
