/* MARK: General Setup */

const player = require('play-sound')(opts = {});

const colors = require('chalk');

const log = console.log;

const dotenv = require('dotenv');
dotenv.config();


/* MARK: IRC Initialization */

const TwitchJS = require('twitch-js');

const options = {
    channels: ["#saltyteemo"],
    identity: {
        username: process.env.TWITCH_USERNAME,
        password: process.env.TWITCH_PASSWORD
    },
};

const client = new TwitchJS.client(options);


/* MARK: Global Properties */

let totals = {
    "blue": {
        "mushrooms": 0,
        "bets": 0,
    },
    "red": {
        "mushrooms": 0,
        "bets": 0,
    },
};

let timers = {
    "firstBet": process.hrtime(),
    "!collect": process.hrtime(),
};

let bettingStarted = false;

let betComplete = false;


/* MARK: General Functions */

// Once per second, check how long betting has been open.
setInterval(() => {
    // 170 seconds since betting started.
    if (process.hrtime(timers.firstBet)[0] > 170 && bettingStarted && !betComplete) {
        // Check which team is in the lead.
        let higher = {};
        let lower = {};
        let blue = totals.blue;
        let red = totals.red;
        blue.name = "blue";
        red.name = "red";
        
        if (red.mushrooms > blue.mushrooms) {
            higher = red;
            lower = blue;
        } else {
            higher = blue;
            lower = red;
        }

        let myTeam = lower.name;
        let myBet = 5000 + Math.floor(Math.random() * 10);

        client.say(options.channels[0], `!${myTeam} ${myBet}`);

        betComplete = true;
        bettingStarted = false;
    }

    // 60 minutes since last !collect.
    if (process.hrtime(timers["!collect"])[0] > 3600) {
        client.say(options.channels[0], `!collect`);
        timers["!collect"] = process.hrtime();
    }

    // Betting has been open for over 4 minutes.
    if ((totals.blue.mushrooms > 0 || totals.red.mushrooms > 0) && process.hrtime(timers.firstBet)[0] > 240) {
        // Reset global properties.
        totals.blue.mushrooms = 0;
        totals.blue.bets = 0;
        totals.red.mushrooms = 0;
        totals.red.bets = 0;
        betComplete = false;
        bettingStarted = false;

        log(colors.gray("Betting has ended"));
    }
}, 1000);


/* MARK: Event Handlers */

function handleSaltbotMessage(channel, message) {
    // Message contains a processed bet.
    if (message.includes("Bet complete for")) {
        // First bet of the game.
        if (totals.blue.mushrooms === 0 && totals.red.mushrooms === 0) {
            timers.firstBet = process.hrtime();
            bettingStarted = true;

            // Play audio file.
            player.play("teemo.mp3", function(err) {
                if (err && !err.killed) throw err;
            });
        }

        const bet = message.split("Bet complete for ")[1].split(". Your new balance is")[0].toLowerCase().split(", ");
        const team = bet[0];
        const mushrooms = parseInt(bet[1]);

        totals[team].mushrooms += mushrooms;
        totals[team].bets += 1;

        let seconds = process.hrtime(timers.firstBet)[0];
        let _blue = colors.blueBright(totals.blue.mushrooms.toLocaleString());
        let _red = colors.redBright(totals.red.mushrooms.toLocaleString());

        log(colors.whiteBright(`Betting open for ${seconds} seconds`));
        log(`${_blue} | ${_red}`);
    }

    // Betting is over OR 300 seconds have elapsed.
    if ((totals.blue.mushrooms > 0 || totals.red.mushrooms > 0) && message.includes("Betting has ended")) {
        // Reset global properties.
        totals.blue.mushrooms = 0;
        totals.blue.bets = 0;
        totals.red.mushrooms = 0;
        totals.red.bets = 0;
        betComplete = false;
        bettingStarted = false;

        log(colors.gray("Betting has ended"));
    }
}

function handleMyMessage(channel, username, message) {
    log(`<${colors.cyanBright(username)}> ${message}`);
}

function handleOtherMessage(channel, username, message) {
}

client.on('chat', (channel, userstate, message, self) => {
    const username = userstate["display-name"];

    switch (username) {
        case "xxsaltbotxx":
            handleSaltbotMessage(channel, message);
            break;
        case "Chuby1Tubby":
            handleMyMessage(channel, username, message);
            break;
        default:
            handleOtherMessage(channel, username, message);
            break;
    }
});


/* MARK: Establish Connection */

console.clear();
client.connect();
log(colors.greenBright("Connection established!\n"));