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
#   MA_GEO         GeoJSON path for MA (default: ${WORK_DIR}/data/ma_precincts.geojson)
#   TX_GEO         GeoJSON path for TX (default: ${WORK_DIR}/data/tx_vtds.geojson)
#
# Example:
#   sbatch ei.slurm
#   EI_STATES=TX EI_TUNE=1500 EI_DRAWS=1000 sbatch ei.slurm

set -euo pipefail

WORK_DIR="${WORK_DIR:-/lustre/nvwulf/scratch/jungshwang/HPC}"
SIF="${WORK_DIR}/pyei.sif"
VENV_DIR="${WORK_DIR}/.venv"
SCRIPT="${WORK_DIR}/psrc/preprocess/run_ei.py"
RESULTS_DIR="${WORK_DIR}/results"
EI_STATES="${EI_STATES:-MA TX}"
EI_TUNE="${EI_TUNE:-2000}"
EI_DRAWS="${EI_DRAWS:-2000}"
MA_GEO="${MA_GEO:-${WORK_DIR}/data/ma_precincts.geojson}"
TX_GEO="${TX_GEO:-${WORK_DIR}/data/tx_vtds.geojson}"

echo "========================================"
echo "PyEI — states: ${EI_STATES}"
echo "Job ID: ${SLURM_JOB_ID}  Node: ${SLURMD_NODENAME}"
echo "Tune: ${EI_TUNE}  Draws: ${EI_DRAWS}"
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

    singularity exec --bind "${WORK_DIR}:${WORK_DIR}" --pwd "${WORK_DIR}" "$SIF" \
        bash -c "source ${VENV_DIR}/bin/activate && \
            OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 \
            python3 ${SCRIPT} \
                --precinct-data ${geo} \
                --state ${st} \
                --output-dir ${RESULTS_DIR} \
                --tune ${EI_TUNE} \
                --draws ${EI_DRAWS} \
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
