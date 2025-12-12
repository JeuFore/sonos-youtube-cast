import "dotenv/config";
import tracer from "tracer";
import YouTubeCastReceiver, {
    RESET_PLAYER_ON_DISCONNECT_POLICIES,
} from "yt-cast-receiver";
import type {
    LogLevel,
} from "yt-cast-receiver";

import SonosPlayer from "./player";

const tracerLogger = tracer.console({
    format:
        process.env.LOG_LEVEL === "debug"
            ? "{{timestamp}} <{{title}}> {{message}} (in {{file}}:{{line}})"
            : "{{timestamp}} <{{title}}> {{message}}",
    preprocess: function (data) {
        data.title = data.title.toUpperCase();
    },
    level: process.env.LOG_LEVEL || "info",
});

const logger = {
    error: (...msg: any[]) => tracerLogger.error(...msg),
    warn: (...msg: any[]) => tracerLogger.warn(...msg),
    info: (...msg: any[]) => tracerLogger.info(...msg),
    debug: (...msg: any[]) => tracerLogger.debug(...msg),
    setLevel: (level: LogLevel) => { /* tracer doesn't support dynamic level changes */ },
};

logger.info("YouTube Cast Receiver is starting...");


const player = new SonosPlayer(logger);

const receiver = new YouTubeCastReceiver(player, {
    dial: { port: 8099 }, // DIAL server port
    app: {
        resetPlayerOnDisconnectPolicy:
            RESET_PLAYER_ON_DISCONNECT_POLICIES.ALL_EXPLICITLY_DISCONNECTED,
        screenApp: "yt-cast-receiver",
    },
    device: {
        name: process.env.DEVICE_NAME || "My YouTube Cast Receiver",
        model: "chromecast-audio",
    },
    logger,
    logLevel: (process.env.LOG_LEVEL as LogLevel | undefined) || "info",
});

receiver.on('senderConnect', (sender) => {
    const nameParts = [] as string[];
    if (sender.user?.name)
        nameParts.push(sender.user.name);
    if (sender.client?.name)
        nameParts.push(sender.client.name);

    const nameStr = sender.name + (nameParts.length > 0 ? ` (${nameParts.join(' - ')})` : '');

    logger.info(`Connected to ${nameStr}. Total connected senders: ${receiver.getConnectedSenders().length}`);

    if (receiver.getConnectedSenders().length === 1)
        player.clearDeviceQueue();
});

receiver.on('senderDisconnect', (sender, implicit) => {
    logger.info(`Disconnected from ${sender.name} (${sender.client?.name}${implicit ? ' - implicit' : ''}). Remaining connected senders: ${receiver.getConnectedSenders().length}`);

    player.stopPlaylistInterval();

    if (receiver.getConnectedSenders().length === 0)
        player.clearDeviceQueue();
});

receiver.on('error', (error) => {
    logger.error('[FakePlayerDemo] Error occurred:', error);
});

receiver.on('terminate', (error) => {
    logger.error('!!!! YouTubeCastReceiver has crashed !!! Reason:', error);
});

receiver.start();