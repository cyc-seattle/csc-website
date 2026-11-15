#!/usr/bin/env bash
# Builds the site from prod's Directus and deploys it live to Firebase Hosting. The org's deploy.yml runs it as
# `mise run deploy`, signed in as deploy-website.
set -euo pipefail

if [[ "$PULUMI_STACK" != prod ]]; then
  echo "deploy builds from prod's Directus and deploys the live site; set PULUMI_STACK=prod" >&2
  exit 1
fi

# The Website Build user's token, read straight into the build's environment and never printed.
DIRECTUS_TOKEN="$(gcloud secrets versions access latest --secret "$DIRECTUS_TOKEN_SECRET" --project "$FIREBASE_PROJECT")"
export DIRECTUS_TOKEN
CONTENT_SOURCE=directus mise run build

# firebase.json names no site, so each deploy says which one. Firebase reads `public` relative to the config file,
# so the copy sits beside the original.
config=firebase.deploy.json
trap 'rm -f "$config"' EXIT
jq --arg site "$FIREBASE_SITE" '.hosting.site = $site' firebase.json > "$config"
firebase=(pnpm exec firebase --config "$config" --project "$FIREBASE_PROJECT" --non-interactive)

"${firebase[@]}" deploy --only hosting --message "${GITHUB_SHA:-local}"
