#!/bin/bash
set -e
SITE=vijayajewelleryllc
SRC="${1:-https://raw.githubusercontent.com/rrksharjah-eng/kampallur-poster/main/tmp/vj_index_deepavali.html}"
API=https://firebasehosting.googleapis.com/v1beta1
T=$(gcloud auth print-access-token)
H=(-H "Authorization: Bearer $T" -H "Content-Type: application/json" -H "x-goog-user-project: vijaya-jewellery-llc")
CUR=$(curl -s "${H[@]}" "$API/sites/$SITE/releases?pageSize=1" | python3 -c "import sys,json;print(json.load(sys.stdin)['releases'][0]['version']['name'])")
echo "PREVIOUS_VERSION=$CUR"; echo "$CUR" >> ~/vj_prev_versions.txt
CFG=$(curl -s "${H[@]}" "$API/$CUR" | python3 -c "import sys,json;print(json.dumps({'config':json.load(sys.stdin).get('config',{})}))")
curl -s "${H[@]}" "$API/$CUR/files?pageSize=1000" > /tmp/vjfiles.json
curl -sfL "$SRC" -o /tmp/vjindex.html
grep -q "deepavali\|x-app" /tmp/vjindex.html
gzip -9 -n -c /tmp/vjindex.html > /tmp/vjindex.gz
NH=$(sha256sum /tmp/vjindex.gz | cut -d' ' -f1)
NEW=$(curl -s "${H[@]}" -X POST "$API/sites/$SITE/versions" -d "$CFG" | python3 -c "import sys,json;print(json.load(sys.stdin)['name'])")
echo "NEW_VERSION=$NEW"
BODY=$(python3 -c "
import json
f={x['path']:x['hash'] for x in json.load(open('/tmp/vjfiles.json')).get('files',[])}
f['/index.html']='$NH'
print(json.dumps({'files':f}))")
POP=$(curl -s "${H[@]}" -X POST "$API/$NEW:populateFiles" -d "$BODY")
URL=$(echo "$POP" | python3 -c "import sys,json;print(json.load(sys.stdin)['uploadUrl'])")
for h in $(echo "$POP" | python3 -c "import sys,json;print(' '.join(json.load(sys.stdin).get('uploadRequiredHashes',[])))"); do
 if [ "$h" = "$NH" ]; then curl -s -H "Authorization: Bearer $T" -H "x-goog-user-project: vijaya-jewellery-llc" -H "Content-Type: application/octet-stream" --data-binary @/tmp/vjindex.gz "$URL/$h" >/dev/null; echo uploaded index; else echo "MISSING $h"; exit 1; fi
done
curl -s "${H[@]}" -X PATCH "$API/$NEW?update_mask=status" -d '{"status":"FINALIZED"}' >/dev/null
curl -s "${H[@]}" -X POST "$API/sites/$SITE/releases?versionName=$NEW" -d '{}' | python3 -c "import sys,json;print('RELEASED',json.load(sys.stdin).get('name'))"
