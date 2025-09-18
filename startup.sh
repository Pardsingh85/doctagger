#!/usr/bin/env bash
set -euxo pipefail

# run from the deployed site root
cd /home/site/wwwroot

# make local code importable (doctagger_backend + doc_tagger_daemon)
export PYTHONPATH="/home/site/wwwroot:$PYTHONPATH"

# keep pip up to date
python -m pip install --upgrade pip

# install server runtime deps to the *user* site (persists under /home)
python -m pip install --user --no-warn-script-location "uvicorn[standard]" gunicorn

# install your app deps
python -m pip install --user --no-warn-script-location -r requirements.txt

# ensure user-installed binaries are on PATH
export PATH="$HOME/.local/bin:$PATH"

# launch FastAPI with Gunicorn + Uvicorn worker
exec python -m gunicorn -w 2 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 doctagger_backend.main:app
