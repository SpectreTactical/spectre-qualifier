#!/bin/bash
# Writes sw.js with a cache name from the hash of every cached file, so phones pick up a new version.
cd "$(dirname "$0")"
H=$(cat index.html app.js engine.js reg-core.js firebase-config.js qrcode.js qualifiers/*.js manifest.webmanifest indemnity-pdf.js indemnity-form.pdf sw.src.js | sha256sum | cut -c1-12)
sed "s/__HASH__/$H/" sw.src.js > sw.js
echo "sw.js cache spectre-qualifier-$H"
