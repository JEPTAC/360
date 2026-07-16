#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
printf '\nSan Pedro Territorio 3D: http://localhost:8080\n\n'
python3 -m http.server 8080
