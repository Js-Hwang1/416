#!/bin/bash
#============================================================================
# submit_job.sh -- Legacy SLURM wrapper (same idea as ensemble.slurm)
#
# Prefer the maintained scripts in this directory:
#   setup.slurm / setup_gerrychain.slurm — environment
#   ei.slurm                               — PyEI (Prepro-9)
#   ensemble.slurm                         — GerryChain ensemble (+ optional JSON export)
#   test.slurm                             — short smoke test
#
# Usage:
#   sbatch submit_job.sh                    # defaults: race_blind, 250 plans
#   sbatch submit_job.sh vra 5000           # VRA mode, 5000 plans
#   sbatch submit_job.sh race_blind 5000    # race-blind, 5000 plans
#============================================================================

#SBATCH --job-name=gerrychain
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=28
#SBATCH --time=24:00:00
#SBATCH --output=slurm_%j.log
#SBATCH --error=slurm_%j.err

# ── Parameters (override via command line args) ──────────────────────
MODE=${1:-race_blind}          # "race_blind" or "vra"
TOTAL_PLANS=${2:-250}          # number of plans to generate
NUM_CORES=${SLURM_CPUS_PER_TASK:-28}

# ── Paths ────────────────────────────────────────────────────────────
HPC_DIR="$(cd "$(dirname "$0")" && pwd)"
PSRC_DIR="${HPC_DIR}/psrc"
RESULTS_DIR="${HPC_DIR}/results"
CONFIG="${HPC_DIR}/data/state_config.json"

# Detect state abbreviation from config
STATE=$(python3 -c "import json; print(json.load(open('${CONFIG}'))['state_abbr'])")

echo "========================================"
echo "  GerryChain Ensemble Generation"
echo "  State:       ${STATE}"
echo "  Mode:        ${MODE}"
echo "  Total plans: ${TOTAL_PLANS}"
echo "  Cores:       ${NUM_CORES}"
echo "  Config:      ${CONFIG}"
echo "  Output:      ${RESULTS_DIR}"
echo "  Job ID:      ${SLURM_JOB_ID}"
echo "========================================"

# ── Environment setup ────────────────────────────────────────────────
# Uncomment and adjust for your SeaWulf environment:
# module load anaconda3
# conda activate gerrychain
# -- OR --
# module load python/3.11
# source ${HPC_DIR}/venv/bin/activate

mkdir -p "${RESULTS_DIR}"

# ── Launch one process per core (SeaWulf-4) ──────────────────────────
echo ""
echo "Launching ${NUM_CORES} parallel processes ..."
START_TIME=$(date +%s)

for CORE_ID in $(seq 0 $((NUM_CORES - 1))); do
    python3 "${PSRC_DIR}/seawulf/run_ensemble.py" \
        --config "${CONFIG}" \
        --mode "${MODE}" \
        --core-id "${CORE_ID}" \
        --num-cores "${NUM_CORES}" \
        --total-plans "${TOTAL_PLANS}" \
        --output-dir "${RESULTS_DIR}" \
        > "${RESULTS_DIR}/${STATE}_${MODE}_core${CORE_ID}.log" 2>&1 &
done

# Wait for all cores to finish
wait
ELAPSED=$(( $(date +%s) - START_TIME ))
echo ""
echo "All ${NUM_CORES} cores finished in ${ELAPSED}s"

# ── Aggregate results ────────────────────────────────────────────────
echo ""
echo "Writing frontend JSON via populate_from_hpc.py ..."
python3 "${HPC_DIR}/populate_from_hpc.py" --json-only \
    --results-dir "${RESULTS_DIR}"

echo ""
echo "========================================"
echo "  Job complete!"
echo "  Results in: ${RESULTS_DIR}"
echo "  Total time: ${ELAPSED}s"
echo "========================================"
