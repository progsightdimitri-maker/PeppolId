const https = require('https');

https.get('https://directory.peppol.eu/public/locale-en_US/menuitem-docs-rest-api', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(data);
  });
}).on('error', (err) => {
  console.log("Error: " + err.message);
});
