// server.js
const express = require('express');
const WebSocket = require('ws');
const puppeteer = require('puppeteer');

const app = express();
const HTTP_PORT = 3000;
const WS_PORT = 3001;

let latestOglasi = [];

async function fetchOglase() {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto('https://www.willhaben.at/iad/gebrauchtwagen/auto/gebrauchtwagenboerse?PRICE_TO=15000&YEAR_MODEL_FROM=1990', {waitUntil: 'networkidle2'});

    const oglasi = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[data-testid^="search-result-entry"]')).slice(0,5).map(el => {
            const naslov = el.querySelector('h3')?.innerText.trim() || '';
            const cijena = el.querySelector('span[data-testid^="search-result-entry-price"]')?.innerText.trim() || '';
            const slika = el.querySelector('img')?.src || '';
            const teaser = el.querySelectorAll('[data-testid*="teaser-attributes"] > div');
            const godiste = teaser[0]?.querySelector('span')?.innerText.trim() || '';
            const kilometraza = teaser[1]?.querySelector('span')?.innerText.trim() || '';
            const opis = el.querySelector('div[data-testid="search-result-entry-description"]')?.innerText.trim() || '';
            const telMatch = opis.match(/(\+43|0)[0-9][0-9\s/-]{5,}/);
            const telefon = telMatch ? telMatch[0] : null;
            const href = el.getAttribute('href');
            const link = href ? `https://www.willhaben.at${href}` : '';
            return { naslov, cijena, slika, godiste, kilometraza, opis, telefon, link };
        });
    });

    await browser.close();
    return oglasi;
}

// REST endpoint (za test)
app.get('/oglasi', async (req, res) => {
    const oglasi = await fetchOglase();
    res.json(oglasi);
});

app.listen(HTTP_PORT, () => console.log(`HTTP server: http://localhost:${HTTP_PORT}`));

// WebSocket server
const wss = new WebSocket.Server({ port: WS_PORT });
console.log(`WebSocket server: ws://localhost:${WS_PORT}`);

wss.on('connection', async ws => {
    console.log('Novi klijent');
    
    // Pošalji odmah latest
    if (latestOglasi.length) ws.send(JSON.stringify(latestOglasi));

    const interval = setInterval(async () => {
        try {
            const oglasi = await fetchOglase();
            // Ako ima novi oglas, pošalji update
            if (JSON.stringify(oglasi) !== JSON.stringify(latestOglasi)) {
                latestOglasi = oglasi;
                ws.send(JSON.stringify(oglasi));
            }
        } catch(e) {
            console.error(e);
        }
    }, 5000);

    ws.on('close', () => clearInterval(interval));
});
