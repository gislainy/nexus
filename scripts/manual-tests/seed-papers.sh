#!/usr/bin/env bash
# scripts/manual-tests/seed-papers.sh
#
# Seeds the knowledge base with the two core papers used for manual testing.
# Run from the nexus/ root directory.
#
# Usage:
#   bash scripts/manual-tests/seed-papers.sh <path-to-nexus-knowledge-base>
#
# Example:
#   bash scripts/manual-tests/seed-papers.sh ../nexus-knowledge-base
#
# Prerequisites:
#   - pdftotext installed (macOS: brew install poppler)
#   - docker compose running (infra/docker-compose.yml)
#   - ollama running locally (ollama serve)
#   - knowledge-engine service running (pnpm --filter knowledge-engine dev)

set -euo pipefail

# ─── Arguments ────────────────────────────────────────────────────────────────

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/manual-tests/seed-papers.sh <path-to-nexus-knowledge-base>"
  echo "Example: bash scripts/manual-tests/seed-papers.sh ../nexus-knowledge-base"
  exit 1
fi

KB_PATH="${1%/}"  # strip trailing slash if any

# ─── Prerequisites check ───────────────────────────────────────────────────────

echo "==> Checking prerequisites..."

if ! command -v pdftotext &> /dev/null; then
  echo "ERROR: pdftotext not found."
  echo "  macOS:  brew install poppler"
  echo "  Ubuntu: sudo apt-get install poppler-utils"
  exit 1
fi

PDF_WUST="${KB_PATH}/core/wust2018.pdf"
PDF_KURT="${KB_PATH}/core/kurt2025smart.pdf"

if [[ ! -f "$PDF_WUST" ]]; then
  echo "ERROR: File not found: $PDF_WUST"
  exit 1
fi

if [[ ! -f "$PDF_KURT" ]]; then
  echo "ERROR: File not found: $PDF_KURT"
  exit 1
fi

if ! curl -sf http://localhost:8004/health > /dev/null; then
  echo "ERROR: knowledge-engine not responding on port 8004."
  echo "  Start it with: pnpm --filter knowledge-engine dev"
  exit 1
fi

echo "    pdftotext: OK"
echo "    PDFs found: OK"
echo "    knowledge-engine (port 8004): OK"

# ─── Extract text ──────────────────────────────────────────────────────────────

echo ""
echo "==> Extracting text from PDFs..."

TMP_WUST="/tmp/wust2018.txt"
TMP_KURT="/tmp/kurt2025smart.txt"

pdftotext "$PDF_WUST" "$TMP_WUST"
echo "    wust2018.pdf → $TMP_WUST"

pdftotext "$PDF_KURT" "$TMP_KURT"
echo "    kurt2025smart.pdf → $TMP_KURT"

# ─── Compute hashes ────────────────────────────────────────────────────────────

echo ""
echo "==> Computing SHA-256 hashes..."

if command -v sha256sum &> /dev/null; then
  HASH_WUST=$(sha256sum "$PDF_WUST" | awk '{print $1}')
  HASH_KURT=$(sha256sum "$PDF_KURT" | awk '{print $1}')
else
  # macOS uses shasum
  HASH_WUST=$(shasum -a 256 "$PDF_WUST" | awk '{print $1}')
  HASH_KURT=$(shasum -a 256 "$PDF_KURT" | awk '{print $1}')
fi

echo "    wust2018:    $HASH_WUST"
echo "    kurt2025:    $HASH_KURT"

# ─── Index paper 1: Wüst & Gervais (2018) ────────────────────────────────────

echo ""
echo "==> Indexing paper 1/2: Wüst & Gervais (2018)..."

pnpm --filter knowledge-engine index-paper \
  --title "Do you need a blockchain?" \
  --authors "Wüst, K." \
  --authors "Gervais, A." \
  --year 2018 \
  --venue "Crypto Valley Conference on Blockchain Technology" \
  --doi "10.1109/CVCBT.2018.00011" \
  --submodule-path "core/wust2018.pdf" \
  --pdf-hash "$HASH_WUST" \
  --access-type open \
  --layer core \
  --tags TECHNICAL_JUSTIFICATION \
  --tags blockchain \
  --text-file "$TMP_WUST"

# ─── Index paper 2: Türkeli (2025) ───────────────────────────────────────────

echo ""
echo "==> Indexing paper 2/2: Türkeli (2025)..."

pnpm --filter knowledge-engine index-paper \
  --title "Smart Contracts, Blockchain, and Health Policies: Past, Present, and Future" \
  --authors "Türkeli, S." \
  --year 2025 \
  --venue "Information (MDPI), Vol. 16, No. 10" \
  --doi "10.3390/info16100853" \
  --submodule-path "core/kurt2025smart.pdf" \
  --pdf-hash "$HASH_KURT" \
  --access-type open \
  --layer core \
  --tags TECHNICAL_JUSTIFICATION \
  --tags blockchain \
  --tags smart-contract \
  --text-file "$TMP_KURT"

# ─── Confirm in database ──────────────────────────────────────────────────────

echo ""
echo "==> Confirming in database..."

docker compose -f infra/docker-compose.yml exec postgres \
  psql -U nexus -d nexus_dev -c \
  'SELECT title, year, layer, "accessType" FROM knowledge_engine."Paper" ORDER BY "indexedAt";'

echo ""
echo "==> Chunk count per paper:"

docker compose -f infra/docker-compose.yml exec postgres \
  psql -U nexus -d nexus_dev -c \
  'SELECT p.title, COUNT(kc.id) AS chunks
   FROM knowledge_engine."Paper" p
   LEFT JOIN knowledge_engine."KnowledgeChunk" kc ON kc."paperId" = p.id
   GROUP BY p.id, p.title
   ORDER BY p."indexedAt";'

echo ""
echo "Done. Both papers are indexed."
