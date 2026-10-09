#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'Inkspire: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Inkspire Docker LAN
Usage: ./scripts/docker.sh [init|up|status|down|export-ca|help]

  init       Buat .env.docker private; file existing dipertahankan.
  up         Validasi, build, recreate services, lalu tampilkan status.
  status     Tampilkan service project inkspire.
  down       Stop project inkspire; volume PKI dipertahankan.
  export-ca  Export root certificate publik; trust device tetap manual.
  help       Tampilkan bantuan tanpa menjalankan Docker.

Quickstart: init -> edit .env.docker -> up (Docker Engine Linux native).
USAGE
}

[[ $# -le 1 ]] || fail 'Gunakan satu subcommand saja; lihat help.'
action="${1:-help}"
case "$action" in
  help|-h|--help) usage; exit 0 ;;
  init|up|status|down|export-ca) ;;
  *) fail 'Subcommand tidak dikenal; lihat help.' ;;
esac

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
env_file="$root/.env.docker"

if [[ "$action" == init ]]; then
  if [[ -e "$env_file" || -L "$env_file" ]]; then
    printf 'Konfigurasi existing dipertahankan: %s\n' "$env_file"
    exit 0
  fi
  if ! (umask 077; set -o noclobber; cat "$root/deploy/docker.env.example" > "$env_file"); then
    fail 'Template tidak dapat disalin; periksa izin folder.'
  fi
  chmod 600 "$env_file"
  printf 'Dibuat: %s\nIsi INKSPIRE_PUBLIC_ORIGIN dan konfigurasi MaPic dengan editor, lalu jalankan up.\n' "$env_file"
  exit 0
fi

[[ -f "$env_file" ]] || fail '.env.docker belum tersedia; jalankan init lalu isi konfigurasi.'
[[ "$(uname -s)" == Linux ]] || fail 'Deployment ini memerlukan Docker Engine Linux native.'
[[ -z "${DOCKER_HOST:-}" ]] || fail 'Kosongkan override DOCKER_HOST untuk memakai context lokal.'
command -v docker >/dev/null 2>&1 || fail 'Docker CLI belum tersedia.'
docker compose version >/dev/null 2>&1 || fail 'Docker Compose v2 belum tersedia.'

endpoint="$(docker context inspect --format '{{.Endpoints.docker.Host}}' 2>/dev/null)" \
  || fail 'Context Docker tidak dapat diperiksa.'
[[ "$endpoint" == unix://* ]] || fail 'Gunakan context Docker lokal dengan socket Unix.'
daemon="$(docker info --format '{{.OSType}}|{{.OperatingSystem}}|{{json .SecurityOptions}}' 2>/dev/null)" \
  || fail 'Docker daemon tidak dapat diakses.'
[[ "$daemon" == "linux|"* ]] || fail 'Daemon Docker harus Linux.'
[[ "$daemon" != *"Docker Desktop"* ]] || fail 'Docker Desktop bukan target deployment ini.'
[[ "$daemon" != *rootless* ]] || fail 'Daemon rootless memerlukan peninjauan networking.'

# Configuration is parsed by Compose only; never source or evaluate the env file.
unset INKSPIRE_PORT INKSPIRE_PUBLIC_ORIGIN INKSPIRE_IMAGE
export INKSPIRE_ENV_FILE="$env_file"
compose=(docker compose --project-directory "$root" --project-name inkspire
  --env-file "$env_file" --file "$root/compose.yaml")

if ! "${compose[@]}" config --quiet >/dev/null 2>&1; then
  fail 'Konfigurasi Compose tidak valid; periksa .env.docker dan compose.yaml tanpa mencetak kredensial.'
fi

case "$action" in
  up)
    "${compose[@]}" build lan-config
    "${compose[@]}" up -d --force-recreate
    "${compose[@]}" ps --all
    printf 'Periksa HTTPS dengan CA/hostname validation. Gunakan export-ca untuk sertifikat publik.\n'
    ;;
  status) "${compose[@]}" ps --all ;;
  down)
    "${compose[@]}" down
    printf 'Project dihentikan; volume PKI dipertahankan.\n'
    ;;
  export-ca)
    "${compose[@]}" cp proxy:/app/.inkspire-lan/data/pki/authorities/local/root.crt "$root/inkspire-lan-root.crt"
    printf 'Root certificate: %s\nVerifikasi fingerprint dan pasang trust device secara manual.\n' "$root/inkspire-lan-root.crt"
    ;;
esac
