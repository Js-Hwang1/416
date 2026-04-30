#!/bin/bash
#SBATCH --job-name=ensemble
#SBATCH --partition=b40x4-long
#SBATCH --cpus-per-task=62
#SBATCH --ntasks=1
#SBATCH --mem=300G
#SBATCH --time=2-00:00:00
#SBATCH --output=logs/ensemble_%j.out

# GerryChain ensemble (SeaWulf): one Python process per core, then optional JSON export.
#
# Edit #SBATCH above for your allocation (e.g. multi-node MA: nodes=2, ntasks=124,
# cpus-per-task=1, mem-per-cpu=2400M).
#
# Environment overrides (export before sbatch, or prefix the command):
#   WORK_DIR       HPC root on scratch (default below)
#   STATE          TX | MA (default: TX)
#   MODE           race_blind | vra (default: race_blind)
#   CONFIG         Full path to state_config.json (default: from STATE)
#   NUM_CORES      Must match cores allocated to this job (default: 62)
#   TOTAL_PLANS    Plans across all cores (default: 5000)
#   RECOM_STEPS    Thinning between saved plans (default: 10000)
#   PLAN_LIST      If set, passed to run_ensemble (--plan-list); often pair with small NUM_CORES
#   PLAN_OFFSET    Optional plan ID offset (default: 0)
#   USE_SRUN       1 = wrap each task in srun --exclusive (multi-node); 0 = background on one node
#   RUN_POPULATE   1 = run populate_from_hpc.py --json-only after wait (default: 1)
#
# Examples:
#   sbatch ensemble.slurm
#   MODE=vra sbatch ensemble.slurm
#   STATE=MA NUM_CORES=9 TOTAL_PLANS=500 sbatch ensemble.slurm
#   USE_SRUN=1 STATE=MA NUM_CORES=124 sbatch ensemble.slurm   # after editing #SBATCH for 2 nodes
#   PLAN_LIST=${WORK_DIR}/data/gapfill.txt NUM_CORES=2 TOTAL_PLANS=2 RUN_POPULATE=0 sbatch ensemble.slurm

set -euo pipefail

WORK_DIR="${WORK_DIR:-/lustre/nvwulf/scratch/jungshwang/HPC}"
SIF="${WORK_DIR}/pyei.sif"
VENV_DIR="${WORK_DIR}/.venv"
PSRC_DIR="${WORK_DIR}/psrc"
RESULTS_DIR="${WORK_DIR}/results"

STATE="${STATE:-TX}"
MODE="${MODE:-race_blind}"
NUM_CORES="${NUM_CORES:-62}"
TOTAL_PLANS="${TOTAL_PLANS:-5000}"
RECOM_STEPS="${RECOM_STEPS:-10000}"
PLAN_OFFSET="${PLAN_OFFSET:-0}"
USE_SRUN="${USE_SRUN:-0}"
RUN_POPULATE="${RUN_POPULATE:-1}"

if [[ -z "${CONFIG:-}" ]]; then
    case "$(echo "$STATE" | tr '[:lower:]' '[:upper:]')" in
        TX) CONFIG="${WORK_DIR}/data/tx_state_config.json" ;;
        MA) CONFIG="${WORK_DIR}/data/ma_state_config.json" ;;
        *)
            echo "ERROR: STATE=${STATE} — set CONFIG explicitly."
            exit 1
            ;;
    esac
fi

echo "========================================"
echo "GerryChain ensemble  ${STATE}  ${MODE}"
echo "Job ID: ${SLURM_JOB_ID}  Node(s): ${SLURM_NODELIST:-local}"
echo "Cores: ${NUM_CORES}  Plans: ${TOTAL_PLANS}  ReCom/plan: ${RECOM_STEPS}"
echo "CONFIG: ${CONFIG}"
echo "USE_SRUN: ${USE_SRUN}  RUN_POPULATE: ${RUN_POPULATE}"
echo "Start: $(date)"
echo "========================================"

mkdir -p "${RESULTS_DIR}" "${WORK_DIR}/logs"

START_TIME=$(date +%s)

run_core() {
    local CORE_ID="$1"
    local log="${RESULTS_DIR}/${STATE}_${MODE}_core${CORE_ID}.log"
    local inner
    inner="source ${VENV_DIR}/bin/activate && OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 python3 -u ${PSRC_DIR}/seawulf/run_ensemble.py --config ${CONFIG} --mode ${MODE} --core-id ${CORE_ID} --num-cores ${NUM_CORES} --total-plans ${TOTAL_PLANS} --recom-steps ${RECOM_STEPS} --plan-offset ${PLAN_OFFSET} --output-dir ${RESULTS_DIR}"

    if [[ -n "${PLAN_LIST:-}" ]]; then
        inner="${inner} --plan-list ${PLAN_LIST}"
    fi

    if [[ "${USE_SRUN}" = "1" ]]; then
        srun --nodes=1 --ntasks=1 --exclusive \
            singularity exec --bind "${WORK_DIR}:${WORK_DIR}" --pwd "${WORK_DIR}" "${SIF}" \
            bash -c "${inner}" >"${log}" 2>&1 &
    else
        singularity exec --bind "${WORK_DIR}:${WORK_DIR}" --pwd "${WORK_DIR}" "${SIF}" \
            bash -c "${inner}" >"${log}" 2>&1 &
    fi
}

for CORE_ID in $(seq 0 $((NUM_CORES - 1))); do
    run_core "${CORE_ID}"
done

wait
ELAPSED=$(( $(date +%s) - START_TIME ))
echo "Ensemble wall time: ${ELAPSED}s"

if [[ "${RUN_POPULATE}" = "1" ]]; then
    echo "Running populate_from_hpc.py (JSON only) ..."
    singularity exec --bind "${WORK_DIR}:${WORK_DIR}" --pwd "${WORK_DIR}" "${SIF}" \
        bash -c "source ${VENV_DIR}/bin/activate && \
            python3 ${WORK_DIR}/populate_from_hpc.py --json-only \
                --results-dir ${RESULTS_DIR}"
fi

echo "========================================"
echo "Done: $(date)"
echo "========================================"
