const express = require('express');
const fs = require('fs');

const server = express();

// Load configuration from key.json
let config;
try {
  config = JSON.parse(fs.readFileSync('key.json'));
} catch (error) {
  console.error('Error reading key.json:', error);
  process.exit(1);
}

server.all('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.write('<link href="https://fonts.googleapis.com/css?family=Roboto Condensed" rel="stylesheet"> <style> body {font-family: "Roboto Condensed";font-size: 22px;} </style><p>Hosting Active</p>');
  res.end();
});

function keepAlive() {
  // Menggunakan port dari key.json
  const port = config.port || 3000; // Default ke 3000 jika tidak ada
  server.listen(port, () => { console.log("Server is online!") });
}

module.exports = keepAlive;
