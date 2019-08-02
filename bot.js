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
        betting: 180,
        farm: 10800,
        botResponseDefault: 0,
        tallyUpdate: 120
    },
    betAmount: 200 + Math.floor(Math.random() * 1),
    betMultiplier: 0.02,
    fileNames: {
        bettingStartedSound: 'media/teemo.mp3',
        largeBetSound: 'media/nani.mp3',
        statisticsDB: 'data.json'
    },
    largeBetThresholds: {
        regular: 30000,
        massive: 75000
    }
};

let botState = {
	isPaused: false,
	isMuted: false
};


/******************
 * TwitchJS Setup *
 ******************/

// Create an instance of TwitchJS.
console.clear();
console.log(colors.yellowBright('\nConnecting...'));
const { chat } = new TwitchJS({ 'username': preferences.credentials.username, 'token': preferences.credentials.token, log: { level: 0 } });

// Extend TwitchJS functionality.
chat.say = function (mostRecentChannel, message) {
    setTimeout(function () {
        chat.send(`PRIVMSG #${mostRecentChannel} :${message}`);
    }, preferences.delays.botResponse)
};


/*********************
 * Global Properties *
 *********************/

let myBet = 101,
    myTeam = 'blue',
    opposingTeam = 'red',
    betComplete = false,
    notifyTallySent = false,
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
        // chat.say('MrDestructoid')
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
    "!chub": function(arg) {
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
			case "mute":
				if (botState.isMuted === true) {
					response = "I'm already muted";
				} else {
					response = "alerts muted";
					botState.isMuted = true
				}
				break;
			case "unmute":
				if (botState.isMuted === false) {
					response = "I'm already muted";
				} else {
					response = "alerts unmuted";
					botState.isMuted = false
				}
				break;
		}

		chat.send(`PRIVMSG #${mostRecentChannel} :/me @${preferences.credentials.username} ${response}`)
    },
    farm: function() {
        timers.farm = process.hrtime();
        chat.say('!farm')
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

// Extends TwitchJS functionality.
chat.say = limiter(msg => {
	if (!botState.isMuted) {
	    chat.send(`PRIVMSG #${mostRecentChannel} :${msg}`)
	}
}, 1500);

// Calculates the average of an array of numbers.
const avg = (arr) => _.chain(arr)
    .sum()
    .divide(arr.length)
    .round(1)
    .value();

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
    preferences.betAmount = Math.floor(myStats.currentBalance * preferences.betMultiplier);
    if (preferences.betAmount < 100)
        preferences.betAmount = 100;
}

// Write statistics to JSON file.
function updateJSONData() {
    jsonfile.writeFileSync(preferences.fileNames.statisticsDB, {"myStats": myStats})
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
            if (!botState.isMuted)
                player.play(preferences.fileNames.largeBetSound, function(err) { if (err && !err.killed) throw err });

            // Inform chat that a large bet happened.
            //chat.say('/me PogChamp PogChamp LARGE BET PogChamp PogChamp ' + _extra.replace(' <--  ', '').replace('blue', 'saltyt1Blue').replace('red', 'saltyt1Red'))
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
    totals.blue.mushrooms = 0;

    console.log(colors.gray(`[${getFormattedTime()}] Betting has ended\n`))

    // Record how long betting was open to find an average.
    try {
        let obj = jsonfile.readFileSync('history.json');
        let history = obj["history"];
        history.push(process.hrtime(timers.firstBet)[0]);
        jsonfile.writeFileSync('history.json', {"history": history})

        console.log(Math.floor(avg(history)));
    } catch (e) { console.log('history.json failed...', e) }
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
    chat.say(`/me GivePLZ 2 MIN UPDATE TakeNRG saltyt1Blue ${_blueAmount} ${_comparisonSymbol} ${_redAmount} saltyt1Red`)
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

// Once per second, check on the sate of the timers.
setInterval(() => {
    let _secondsSinceFarm = process.hrtime(timers.farm)[0];
    let _secondsSinceFirstBet = process.hrtime(timers.firstBet)[0];

    // Farm mushrooms after x amount of seconds.
    if (_secondsSinceFarm >= preferences.delays.farm)
        commands.farm();

    /*
    if (_secondsSinceFirstBet >= preferences.delays.tallyUpdate && !notifyTallySent && isBettingOpen()) {
        notifyOneHundredSecondTally();
        notifyTallySent = true
    }
    */

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
            if (!botState.isMuted)
                player.play(preferences.fileNames.bettingStartedSound, function(err) { if (err && !err.killed) throw err });

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

    const messageSplit = message.split(" ");
	const cmd = messageSplit[0];
	const arg = messageSplit[1];

    if (typeof commands[cmd] === 'function')
        commands[cmd](arg);

    console.log(`[${getFormattedTime()}] <${colors.cyanBright(username)}> ${message}`)
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
