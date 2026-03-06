#!/bin/bash
#SBATCH --job-name=build-pyei-sif
#SBATCH --partition=b40x4-long
#SBATCH --cpus-per-task=4
#SBATCH --ntasks=1
#SBATCH --mem=16G
#SBATCH --time=01:00:00
#SBATCH --output=logs/build_sif_%j.out

# ── Pull Python 3.11 Docker image as Singularity SIF ──
# No fakeroot needed — singularity pull works without root.
# Python packages are installed into a persistent venv.

WORK_DIR=/lustre/nvwulf/scratch/jungshwang/HPC
SIF_PATH=${WORK_DIR}/pyei.sif
VENV_DIR=${WORK_DIR}/.venv

echo "========================================"
echo "Setting up PyEI Environment"
echo "Job ID: $SLURM_JOB_ID"
echo "Node:   $SLURMD_NODENAME"
echo "Start:  $(date)"
echo "========================================"

mkdir -p ${WORK_DIR}/logs

# Step 1: Pull Python 3.11 image from Docker Hub
if [ -f "$SIF_PATH" ]; then
    echo "Container $SIF_PATH already exists. Skipping pull."
else
    echo "Pulling python:3.11-slim from Docker Hub ..."
    singularity pull "$SIF_PATH" docker://python:3.11-slim

    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to pull container!"
        exit 1
    fi
    echo "SUCCESS: Container pulled."
    ls -lh "$SIF_PATH"
fi

# Step 2: Install Python packages into a persistent venv
echo ""
echo "Installing Python packages into ${VENV_DIR} ..."

singularity exec --bind ${WORK_DIR}:${WORK_DIR} --pwd ${WORK_DIR} "$SIF_PATH" \
    bash -c "
        python3 -m venv ${VENV_DIR} && \
        source ${VENV_DIR}/bin/activate && \
        pip install --no-cache-dir \
            'pyei>=1.1' \
            'numpy' \
            'pandas' \
            'scipy' \
            'matplotlib' \
            'pymongo' && \
        echo '' && \
        echo 'Installed packages:' && \
        pip list
    "

if [ $? -eq 0 ]; then
    echo ""
    echo "SUCCESS: Environment ready."
else
    echo ""
    echo "ERROR: Package installation failed!"
    exit 1
fi

echo "========================================"
echo "Done: $(date)"
echo "========================================"
