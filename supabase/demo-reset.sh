#!/usr/bin/env bash
# ============================================================
# ClubBoost Demo Reset
# ============================================================
# Drops the local Supabase database, re-applies all migrations,
# and loads the demo seed data.
#
# Usage:
#   ./supabase/demo-reset.sh            # full reset + seed
#   ./supabase/demo-reset.sh --seed-only  # skip reset, re-run seed
#
# Prerequisites:
#   - Supabase CLI installed  (brew install supabase/tap/supabase)
#   - Docker running
#   - Local Supabase project initialised (supabase start has been run)
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_FILE="$SCRIPT_DIR/demo-seed.sql"

# ── Colours ──────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[demo-reset]${NC} $*"; }
warning() { echo -e "${YELLOW}[demo-reset]${NC} $*"; }
error()   { echo -e "${RED}[demo-reset]${NC} $*"; exit 1; }

# ── Sanity checks ─────────────────────────────────────────────
command -v supabase &>/dev/null || error "supabase CLI not found. Install: brew install supabase/tap/supabase"
[[ -f "$SEED_FILE" ]] || error "Seed file not found at $SEED_FILE"

SEED_ONLY=false
for arg in "$@"; do
  [[ "$arg" == "--seed-only" ]] && SEED_ONLY=true
done

# ── Full reset ────────────────────────────────────────────────
if [[ "$SEED_ONLY" == false ]]; then
  warning "This will DESTROY all local data and rebuild from migrations."
  read -rp "Continue? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }

  info "Running supabase db reset (applies all migrations)…"
  supabase db reset

  info "Reset complete."
fi

# ── Seed ──────────────────────────────────────────────────────
info "Loading demo seed data…"

# supabase db reset already runs supabase/seed.sql if present.
# The demo seed is a separate file we load explicitly via psql.
DB_URL=$(supabase db url 2>/dev/null || echo "")

if [[ -z "$DB_URL" ]]; then
  # Fallback: construct URL from supabase status output
  DB_PORT=$(supabase status 2>/dev/null | grep "DB URL" | grep -oP ':\K[0-9]+(?=/)' | head -1)
  DB_URL="postgresql://postgres:postgres@127.0.0.1:${DB_PORT:-54322}/postgres"
fi

psql "$DB_URL" -f "$SEED_FILE" && info "Demo seed loaded successfully." \
  || error "Seed failed — check output above for details."

# ── Summary ────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         ClubBoost Demo Environment Ready                 ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  All passwords: Demo1234!                                ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Platform Admin  admin@clubboost.demo                    ║${NC}"
echo -e "${GREEN}║  Club Admin      secretary@hillside-fc.demo              ║${NC}"
echo -e "${GREEN}║  Participant     alice@demo.clubboost                    ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Studio:   http://localhost:54323                        ║${NC}"
echo -e "${GREEN}║  App:      http://localhost:3000                         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
