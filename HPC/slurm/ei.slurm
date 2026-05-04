#!/bin/bash
#SBATCH --job-name=ei
#SBATCH --partition=b40x4-long
#SBATCH --cpus-per-task=62
#SBATCH --ntasks=1
#SBATCH --mem=300G
#SBATCH --time=08:00:00
#SBATCH --output=logs/ei_%j.out

# Ecological inference (Prepro-9): runs preprocess/run_ei.py per state.
#
# Optional environment overrides (before sbatch):
#   WORK_DIR       Scratch HPC root (default below)
#   EI_STATES      Space-separated state abbrevs (default: MA TX)
#   EI_TUNE        MCMC tune steps (default: 2000)
#   EI_DRAWS       MCMC draws (default: 2000)
#   EI_SAMPLER     blackjax | numpyro | nutpie | pymc (default: blackjax CPU; numpyro GPU)
#   EI_CHAIN_METHOD parallel | vectorized | sequential (default: parallel CPU; vectorized GPU)
#   EI_USE_GPU     1 = pass --nv to singularity, switch defaults to GPU-friendly (numpyro+vectorized)
#   MA_GEO         GeoJSON path for MA (default: ${WORK_DIR}/data/ma_precincts.geojson)
#   TX_GEO         GeoJSON path for TX (default: ${WORK_DIR}/data/tx_vtds.geojson)
#
# Example:
#   sbatch ei.slurm                                       # CPU, blackjax (~6 min/state at 200/200)
#   EI_USE_GPU=1 sbatch ei.slurm                          # GPU, numpyro+vectorized (~30s/state expected)
#   EI_STATES=TX EI_TUNE=1500 EI_DRAWS=1000 sbatch ei.slurm
#
# For GPU runs, also adjust the #SBATCH lines:
#   #SBATCH --partition=<your-gpu-partition>
#   #SBATCH --gres=gpu:1

set -euo pipefail

WORK_DIR="${WORK_DIR:-/lustre/nvwulf/scratch/jungshwang/HPC}"
SIF="${WORK_DIR}/pyei.sif"
VENV_DIR="${WORK_DIR}/.venv"
SCRIPT="${WORK_DIR}/psrc/preprocess/run_ei.py"
RESULTS_DIR="${WORK_DIR}/results"
EI_STATES="${EI_STATES:-MA TX}"
EI_TUNE="${EI_TUNE:-2000}"
EI_DRAWS="${EI_DRAWS:-2000}"
EI_USE_GPU="${EI_USE_GPU:-0}"
if [[ "${EI_USE_GPU}" = "1" ]]; then
    EI_SAMPLER="${EI_SAMPLER:-numpyro}"
    EI_CHAIN_METHOD="${EI_CHAIN_METHOD:-vectorized}"
    SINGULARITY_GPU_FLAG="--nv"
else
    EI_SAMPLER="${EI_SAMPLER:-blackjax}"
    EI_CHAIN_METHOD="${EI_CHAIN_METHOD:-parallel}"
    SINGULARITY_GPU_FLAG=""
fi
MA_GEO="${MA_GEO:-${WORK_DIR}/data/ma_precincts.geojson}"
TX_GEO="${TX_GEO:-${WORK_DIR}/data/tx_vtds.geojson}"

echo "========================================"
echo "PyEI — states: ${EI_STATES}"
echo "Job ID: ${SLURM_JOB_ID}  Node: ${SLURMD_NODENAME}"
echo "Tune: ${EI_TUNE}  Draws: ${EI_DRAWS}"
echo "Sampler: ${EI_SAMPLER}  Chain method: ${EI_CHAIN_METHOD}  GPU: ${EI_USE_GPU}"
echo "Start: $(date)"
echo "========================================"

if [[ ! -f "$SIF" ]]; then
    echo "ERROR: Missing container ${SIF}. Run setup.slurm first."
    exit 1
fi
if [[ ! -d "$VENV_DIR" ]]; then
    echo "ERROR: Missing venv ${VENV_DIR}. Run setup.slurm first."
    exit 1
fi

mkdir -p "${RESULTS_DIR}" "${WORK_DIR}/logs"

run_ei_state() {
    local st="$1"
    local geo=""
    case "$(echo "$st" | tr '[:lower:]' '[:upper:]')" in
        MA) geo="$MA_GEO" ;;
        TX) geo="$TX_GEO" ;;
        *)
            echo "ERROR: Unknown state '${st}'. Set MA_GEO/TX_GEO or extend ei.slurm."
            return 1
            ;;
    esac

    echo ""
    echo "----------------------------------------"
    echo "EI ${st}  (${geo})"
    echo "$(date)"
    echo "----------------------------------------"

    singularity exec ${SINGULARITY_GPU_FLAG} --bind "${WORK_DIR}:${WORK_DIR}" --pwd "${WORK_DIR}" "$SIF" \
        bash -c "source ${VENV_DIR}/bin/activate && \
            OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 \
            python3 ${SCRIPT} \
                --precinct-data ${geo} \
                --state ${st} \
                --output-dir ${RESULTS_DIR} \
                --tune ${EI_TUNE} \
                --draws ${EI_DRAWS} \
                --nuts-sampler ${EI_SAMPLER} \
                --chain-method ${EI_CHAIN_METHOD} \
                --skip-plots" || return 1
}

FAIL=0
for st in ${EI_STATES}; do
    if ! run_ei_state "${st}"; then
        FAIL=1
    fi
done

echo ""
echo "========================================"
echo "Done: $(date)"
echo "Results under: ${RESULTS_DIR}/"
ls -lh "${RESULTS_DIR}/" | head -20 || true
echo "========================================"
exit "${FAIL}"
