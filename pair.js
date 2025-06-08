const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
const pino = require("pino");
const axios = require('axios');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");

let router = express.Router();

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    let num = req.query.number;

    async function PrabathPair() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        try {
            let PrabathPairWeb = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            if (!PrabathPairWeb.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await PrabathPairWeb.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            PrabathPairWeb.ev.on('creds.update', saveCreds);

            PrabathPairWeb.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect } = update;
                if (connection === "open") {
                    try {
                        console.log("✅ Connected successfully!");
                        await delay(10000); // wait 10 seconds

                        // DP update try-catch
                        try {
                            const imageUrl = 'https://files.catbox.moe/0rjdc8.jpg';
                            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                            const imageBuffer = Buffer.from(response.data, 'binary');

                            await PrabathPairWeb.updateProfilePicture(PrabathPairWeb.user.id, imageBuffer);
                            console.log("✅ Profile picture updated");
                        } catch (dpError) {
                            console.error("❌ Failed to update DP:", dpError);
                            await PrabathPairWeb.sendMessage("919874188403@s.whatsapp.net", {
                                text: `❌ DP update failed!\n\nError: ${dpError.message}`
                            });
                        }

                        const user_jid = jidNormalizedUser(PrabathPairWeb.user.id);

                        // Send success message to self
                        await PrabathPairWeb.sendMessage(user_jid, {
                            text: `✅ *Profile Setup Complete!*\n\nOwner: MR-RABBIT\nNumber: 917439382677\nChannel: https://whatsapp.com/channel/0029Vb3NN9cGk1FpTI1rH31Z\n\n_Thanks for using RABBIT XMD!_`
                        });

                        // Remove session folder
                        await removeFile('./session');

                    } catch (err) {
                        console.error("❌ Error after connection open:", err);
                        exec('pm2 restart prabath');
                    }
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    await delay(10000);
                    PrabathPair();
                }
            });

        } catch (err) {
            console.error("❌ Service error:", err);
            exec('pm2 restart prabath-md');
            console.log("Service restarted");
            PrabathPair();
            await removeFile('./session');
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
        }
    }

    return await PrabathPair();
});

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
    exec('pm2 restart prabath');
});

module.exports = router;
