#!/bin/bash
#SBATCH --job-name=hpc-smoke
#SBATCH --partition=b40x4
#SBATCH --cpus-per-task=2
#SBATCH --ntasks=1
#SBATCH --mem=16G
#SBATCH --time=00:30:00
#SBATCH --output=logs/test_%j.out

# Quick sanity check: tiny ensemble + import checks (no long MCMC).
#
# Optional env:
#   WORK_DIR   (default below)
#   STATE      TX | MA (default: TX)
#   MODE       race_blind | vra (default: race_blind)

set -euo pipefail

WORK_DIR="${WORK_DIR:-/lustre/nvwulf/scratch/jungshwang/HPC}"
SIF="${WORK_DIR}/pyei.sif"
VENV_DIR="${WORK_DIR}/.venv"
PSRC_DIR="${WORK_DIR}/psrc"
RESULTS_DIR="${WORK_DIR}/results"
STATE="${STATE:-TX}"
MODE="${MODE:-race_blind}"

case "$(echo "$STATE" | tr '[:lower:]' '[:upper:]')" in
    TX) CONFIG="${WORK_DIR}/data/tx_state_config.json" ;;
    MA) CONFIG="${WORK_DIR}/data/ma_state_config.json" ;;
    *) echo "ERROR: Set STATE=TX or MA."; exit 1 ;;
esac

echo "========================================"
echo "HPC smoke test — ${STATE} ${MODE}"
echo "Job ID: ${SLURM_JOB_ID}  Node: ${SLURMD_NODENAME}"
echo "$(date)"
echo "========================================"

if [[ ! -f "$SIF" ]] || [[ ! -d "$VENV_DIR" ]]; then
    echo "ERROR: Run setup.slurm (and setup_gerrychain.slurm) first."
    exit 1
fi

singularity exec --bind "${WORK_DIR}:${WORK_DIR}" --pwd "${WORK_DIR}" "${SIF}" \
    bash -c "source ${VENV_DIR}/bin/activate && \
        python3 -c 'from gerrychain import Graph, Partition; print(\"gerrychain OK\")' && \
        python3 -c 'import networkx; print(\"networkx OK\")'"

mkdir -p "${RESULTS_DIR}" "${WORK_DIR}/logs"

START=$(date +%s)
for CORE_ID in 0 1; do
    singularity exec --bind "${WORK_DIR}:${WORK_DIR}" --pwd "${WORK_DIR}" "${SIF}" \
        bash -c "source ${VENV_DIR}/bin/activate && \
            OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 \
            python3 -u ${PSRC_DIR}/seawulf/run_ensemble.py \
                --config ${CONFIG} \
                --mode ${MODE} \
                --core-id ${CORE_ID} \
                --num-cores 2 \
                --total-plans 2 \
                --recom-steps 50 \
                --output-dir ${RESULTS_DIR}" \
        >"${RESULTS_DIR}/smoke_${STATE}_${MODE}_core${CORE_ID}.log" 2>&1 &
done
wait
END=$(date +%s)
echo "Mini ensemble finished in $((END - START))s"

MODE_DIR="RB"
if [[ "${MODE}" = "vra" ]]; then
    MODE_DIR="VRA"
fi
echo "Sample outputs:"
ls -la "${RESULTS_DIR}/${STATE}/${MODE_DIR}/" 2>/dev/null | head -15 || echo "(no plans dir yet — check logs)"

echo "========================================"
echo "Smoke test done: $(date)"
echo "========================================"
