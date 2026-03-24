async function fetchDoc() {
  const res = await fetch('https://directory.peppol.eu/public/locale-en_US/menuitem-docs-rest-api');
  const text = await res.text();
  console.log(text);
}
fetchDoc();
