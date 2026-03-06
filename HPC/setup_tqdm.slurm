#!/bin/bash
#SBATCH --job-name=setup-tqdm
#SBATCH --partition=debug-b40x4
#SBATCH --cpus-per-task=2
#SBATCH --ntasks=1
#SBATCH --mem=4G
#SBATCH --time=00:10:00
#SBATCH --output=logs/setup_tqdm_%j.out

WORK_DIR=/lustre/nvwulf/scratch/jungshwang/HPC
SIF=${WORK_DIR}/pyei.sif
VENV_DIR=${WORK_DIR}/.venv

echo "Installing tqdm into venv"

singularity exec --bind ${WORK_DIR}:${WORK_DIR} --pwd ${WORK_DIR} "$SIF" \
    bash -c "
        source ${VENV_DIR}/bin/activate && \
        pip install --no-cache-dir tqdm && \
        python3 -c 'from tqdm import tqdm; print(\"tqdm OK\")'
    "

echo "Done: $(date)"
