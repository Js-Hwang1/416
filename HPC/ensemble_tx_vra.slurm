#!/bin/bash
#SBATCH --job-name=ens-TX-vra
#SBATCH --partition=b40x4-long
#SBATCH --cpus-per-task=62
#SBATCH --ntasks=1
#SBATCH --mem=300G
#SBATCH --time=2-00:00:00
#SBATCH --output=logs/ensemble_TX_vra_%j.out

# ── TX VRA-Constrained Ensemble ──
# 5000 plans, 10k ReCom steps between each saved plan, 62 parallel cores

WORK_DIR=/lustre/nvwulf/scratch/jungshwang/HPC
SIF=${WORK_DIR}/pyei.sif
VENV_DIR=${WORK_DIR}/.venv
SCRIPTS_DIR=${WORK_DIR}/scripts
RESULTS_DIR=${WORK_DIR}/results
CONFIG=${WORK_DIR}/data/tx_state_config.json
NUM_CORES=62
TOTAL_PLANS=5000
RECOM_STEPS=10000
MODE=vra
STATE=TX

echo "========================================"
echo "GerryChain — ${STATE} ${MODE}"
echo "Job ID: $SLURM_JOB_ID  Node: $SLURMD_NODENAME"
echo "Plans: $TOTAL_PLANS  ReCom/plan: $RECOM_STEPS  Cores: $NUM_CORES"
echo "Start:  $(date)"
echo "========================================"

mkdir -p ${RESULTS_DIR} ${WORK_DIR}/logs

START_TIME=$(date +%s)

for CORE_ID in $(seq 0 $((NUM_CORES - 1))); do
    singularity exec --bind ${WORK_DIR}:${WORK_DIR} --pwd ${WORK_DIR} "$SIF" \
        bash -c "source ${VENV_DIR}/bin/activate && \
            OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 \
            python3 -u ${SCRIPTS_DIR}/run_ensemble.py \
                --config ${CONFIG} \
                --mode ${MODE} \
                --core-id ${CORE_ID} \
                --num-cores ${NUM_CORES} \
                --total-plans ${TOTAL_PLANS} \
                --recom-steps ${RECOM_STEPS} \
                --output-dir ${RESULTS_DIR}" \
        > "${RESULTS_DIR}/${STATE}_${MODE}_core${CORE_ID}.log" 2>&1 &
done

wait
ELAPSED=$(( $(date +%s) - START_TIME ))
echo "Ensemble done in ${ELAPSED}s"

echo "Aggregating ..."
singularity exec --bind ${WORK_DIR}:${WORK_DIR} --pwd ${WORK_DIR} "$SIF" \
    bash -c "source ${VENV_DIR}/bin/activate && \
        python3 ${SCRIPTS_DIR}/aggregate.py \
            --state ${STATE} --mode ${MODE} --results-dir ${RESULTS_DIR}"

echo "========================================"
echo "Done: $(date)"
ls -lh ${RESULTS_DIR}/${STATE}_${MODE}_* 2>/dev/null
echo "========================================"
