async function checkHeaders() {
  const res = await fetch('https://directory.peppol.eu/search/1.0/json?q=0403053608');
  console.log(Object.fromEntries(res.headers.entries()));
}
checkHeaders();
