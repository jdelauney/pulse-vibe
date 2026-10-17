#!/usr/bin/env bash
# Relais du lanceur des évaluations (Linux, macOS, WSL2) : tout est dans lancer.js, à côté.
exec node "$(dirname "$0")/lancer.js" "$@"
