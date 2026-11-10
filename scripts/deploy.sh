#!/usr/bin/env bash
# Builds the site from $PULUMI_STACK's Directus and deploys it to Firebase Hosting: dev to a preview channel for
# the PR, prod to the live site. The org's deploy.yml runs it as `mise run deploy`, signed in as deploy-website.
set -euo pipefail

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

if [[ "$PULUMI_STACK" == dev ]]; then
  # A PR's run has refs/pull/<number>/merge. A branch deployed by hand gets a channel named for the branch.
  if [[ "${GITHUB_REF:-}" =~ ^refs/pull/([0-9]+)/ ]]; then
    channel="pr-${BASH_REMATCH[1]}"
  else
    channel="$(git rev-parse --abbrev-ref HEAD | tr -c 'a-zA-Z0-9-\n' '-' | cut -c1-40)"
  fi
  "${firebase[@]}" hosting:channel:deploy "$channel" --expires 7d
else
  "${firebase[@]}" deploy --only hosting --message "${GITHUB_SHA:-local}"
fi
