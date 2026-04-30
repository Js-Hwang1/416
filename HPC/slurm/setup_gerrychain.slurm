#!/bin/bash
#SBATCH --job-name=setup-gc
#SBATCH --partition=b40x4
#SBATCH --cpus-per-task=4
#SBATCH --ntasks=1
#SBATCH --mem=16G
#SBATCH --time=01:00:00
#SBATCH --output=logs/setup_gc_%j.out

# Install GerryChain + Geo stack + tqdm into the existing venv (after setup.slurm).

WORK_DIR=/lustre/nvwulf/scratch/jungshwang/HPC
SIF=${WORK_DIR}/pyei.sif
VENV_DIR=${WORK_DIR}/.venv

echo "========================================"
echo "Installing GerryChain into venv"
echo "Job ID: $SLURM_JOB_ID"
echo "Node:   $SLURMD_NODENAME"
echo "Start:  $(date)"
echo "========================================"

if [ ! -f "$SIF" ]; then
    echo "ERROR: Container $SIF not found! Run setup.slurm first."
    exit 1
fi

singularity exec --bind ${WORK_DIR}:${WORK_DIR} --pwd ${WORK_DIR} "$SIF" \
    bash -c "
        source ${VENV_DIR}/bin/activate && \
        pip install --no-cache-dir \
            'gerrychain>=0.3.1' \
            'geopandas>=0.13' \
            'networkx>=3.0' \
            'shapely>=2.0' \
            'tqdm' && \
        echo '' && \
        echo 'Verifying imports...' && \
        python3 -c 'from gerrychain import Graph, MarkovChain, Partition; print(\"GerryChain OK\")' && \
        python3 -c 'import geopandas; print(\"GeoPandas OK\")' && \
        python3 -c 'from tqdm import tqdm; print(\"tqdm OK\")' && \
        echo '' && \
        echo 'Installed packages:' && \
        pip list | grep -iE 'gerry|geopandas|networkx|shapely|fiona|tqdm'
    "

if [ $? -eq 0 ]; then
    echo ""
    echo "SUCCESS: GerryChain environment ready."
else
    echo ""
    echo "ERROR: Installation failed!"
    exit 1
fi

echo "========================================"
echo "Done: $(date)"
echo "========================================"
