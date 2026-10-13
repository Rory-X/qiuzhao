#!/usr/bin/env bash

set -euo pipefail

workbench_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
venv_dir="$workbench_dir/.venv"
bin_dir="$workbench_dir/.bin"
data_dir="$workbench_dir/.jupyter"
port="${PORT:-8888}"

mkdir -p "$bin_dir" "$data_dir"

if [[ ! -x "$venv_dir/bin/jupyter" ]]; then
  if ! python3 -c 'import venv' >/dev/null 2>&1; then
    echo "Python venv is unavailable. On Ubuntu/Debian run: sudo apt-get install python3-venv" >&2
    exit 1
  fi
  python3 -m venv "$venv_dir"
  "$venv_dir/bin/python" -m pip install --disable-pip-version-check \
    "jupyterlab==4.6.1"
fi

if [[ ! -x "$bin_dir/gonb" ]]; then
  GOBIN="$bin_dir" go install github.com/janpfeifer/gonb@v0.11.4
fi

if [[ ! -x "$bin_dir/goimports" ]]; then
  GOBIN="$bin_dir" go install golang.org/x/tools/cmd/goimports@v0.34.0
fi

if [[ ! -x "$bin_dir/gopls" ]]; then
  GOBIN="$bin_dir" go install golang.org/x/tools/gopls@v0.19.1
fi

export PATH="$venv_dir/bin:$bin_dir:$PATH"
export JUPYTER_DATA_DIR="$data_dir"
export GO_LEARNING_API_SERVICE="$workbench_dir/../02_project_structure/api_service"
export GO_LEARNING_LABS="$workbench_dir/../03_architecture_patterns/labs"
export GO_LEARNING_CAPSTONE="$workbench_dir/../05_large_systems/capstone"

if ! jupyter kernelspec list --json | grep -q '"gonb"'; then
  gonb --install
fi

cd "$workbench_dir/notebooks"
exec jupyter lab \
  --ip=127.0.0.1 \
  --port="$port" \
  --ServerApp.port_retries=0 \
  --no-browser \
  --ServerApp.root_dir="$workbench_dir" \
  --IdentityProvider.token= \
  --ServerApp.password=
