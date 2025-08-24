const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const WebSocket = require('ws');

const app = express();
const HTTP_PORT = 3000;
const WS_PORT = 3001;

async function fetchOglase() {
    const response = await fetch('https://www.willhaben.at/iad/gebrauchtwagen/auto/gebrauchtwagenboerse?rows=30&PRICE_TO=15000&YEAR_MODEL_FROM=1990', {
        headers: { "User-Agent": "Mozilla/5.0" }
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    const oglasi = [];
    $('a[data-testid^="search-result-entry"]').slice(0,5).each((i, el) => {
        const href = $(el).attr('href');
        const link = href ? `https://www.willhaben.at${href}` : '';
        const naslov = $(el).find('h3').text().trim();
        const cijena = $(el).find('span[data-testid^="search-result-entry-price"]').text().trim();
        const slika = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
        const teaser = $(el).find('[data-testid*="teaser-attributes"] > div');
        const godiste = teaser.eq(0).find('span').text().trim() || '';
        const kilometraza = teaser.eq(1).find('span').text().trim() || '';

        oglasi.push({ naslov, cijena, slika, godiste, kilometraza, link });
    });

    return oglasi;
}

// REST endpoint
app.get('/oglasi', async (req, res) => {
    try {
        const oglasi = await fetchOglase();
        res.json(oglasi);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(HTTP_PORT, () => console.log(`HTTP server: http://localhost:${HTTP_PORT}`));

// WebSocket server
const wss = new WebSocket.Server({ port: WS_PORT });
console.log(`WebSocket server: ws://localhost:${WS_PORT}`);

wss.on('connection', ws => {
    console.log('Novi klijent povezan');

    fetchOglase().then(data => ws.send(JSON.stringify(data)));

    const interval = setInterval(async () => {
        const data = await fetchOglase();
        if(ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
    }, 5000);

    ws.on('close', () => clearInterval(interval));
});
