#!/bin/bash
#SBATCH --job-name=EI
#SBATCH --partition=b40x4-long
#SBATCH --cpus-per-task=62
#SBATCH --ntasks=1
#SBATCH --mem=300G
#SBATCH --time=08:00:00
#SBATCH --output=logs/EI_%j.out

# ── Run PyEI Ecological Inference for MA and TX ──
# HIGH QUALITY PARAMETERS: tune=2000, draws=2000

WORK_DIR=/lustre/nvwulf/scratch/jungshwang/HPC
SIF=${WORK_DIR}/pyei.sif
VENV_DIR=${WORK_DIR}/.venv
SCRIPT=${WORK_DIR}/scripts/run_ei.py
RESULTS_DIR=${WORK_DIR}/results

echo "========================================"
echo "PyEI Ecological Inference — High Quality"
echo "Job ID: $SLURM_JOB_ID"
echo "Node:   $SLURMD_NODENAME"
echo "CPUs:   $SLURM_CPUS_PER_TASK"
echo "Start:  $(date)"
echo "========================================"

if [ ! -f "$SIF" ]; then
    echo "ERROR: Container $SIF not found!"
    echo "Run setup.slurm first to build the container."
    exit 1
fi

if [ ! -d "$VENV_DIR" ]; then
    echo "ERROR: Virtual environment $VENV_DIR not found!"
    echo "Run setup.slurm first to install packages."
    exit 1
fi

mkdir -p ${RESULTS_DIR}
mkdir -p ${WORK_DIR}/logs

# ── Run MA EI ──
echo ""
echo "========================================"
echo "Running EI for Massachusetts (MA)"
echo "$(date)"
echo "========================================"

singularity exec --bind ${WORK_DIR}:${WORK_DIR} --pwd ${WORK_DIR} "$SIF" \
    bash -c "source ${VENV_DIR}/bin/activate && \
        OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 \
        python3 ${SCRIPT} \
            --precinct-data ${WORK_DIR}/data/ma_precincts.geojson \
            --state MA \
            --output-dir ${RESULTS_DIR} \
            --tune 2000 \
            --draws 2000 \
            --skip-plots"

MA_EXIT=$?
echo ""
echo "MA EI exit code: $MA_EXIT"
echo "MA done at: $(date)"

# ── Run TX EI ──
echo ""
echo "========================================"
echo "Running EI for Texas (TX)"
echo "$(date)"
echo "========================================"

singularity exec --bind ${WORK_DIR}:${WORK_DIR} --pwd ${WORK_DIR} "$SIF" \
    bash -c "source ${VENV_DIR}/bin/activate && \
        OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 \
        python3 ${SCRIPT} \
            --precinct-data ${WORK_DIR}/data/tx_vtds.geojson \
            --state TX \
            --output-dir ${RESULTS_DIR} \
            --tune 2000 \
            --draws 2000 \
            --skip-plots"

TX_EXIT=$?
echo ""
echo "TX EI exit code: $TX_EXIT"
echo "TX done at: $(date)"

echo ""
echo "========================================"
echo "All EI jobs complete: $(date)"
echo "MA exit: $MA_EXIT, TX exit: $TX_EXIT"
echo "Results in: ${RESULTS_DIR}/"
ls -lh ${RESULTS_DIR}/
echo "========================================"
