#!/bin/bash
set -e
SITE=vijayajewelleryllc; API=https://firebasehosting.googleapis.com/v1beta1
V="${1:-$(head -1 ~/vj_prev_versions.txt)}"
T=$(gcloud auth print-access-token)
curl -s -H "Authorization: Bearer $T" -H "x-goog-user-project: vijaya-jewellery-llc" -H "Content-Type: application/json" -X POST "$API/sites/$SITE/releases?versionName=$V" -d '{}' | python3 -c "import sys,json;print('ROLLED BACK',json.load(sys.stdin).get('name'))"
