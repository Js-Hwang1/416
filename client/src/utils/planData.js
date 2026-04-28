export function generateDummyPlanData(numDistricts, planType) {
  const seed = planType.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = (i) => {
    const x = Math.sin(seed * 9301 + i * 49297 + 233280) * 49297;
    return x - Math.floor(x);
  };

  const districts = [];
  for (let d = 1; d <= numDistricts; d++) {
    let demLean;
    switch (planType) {
      case "max_d":
        demLean = 0.35 + rng(d) * 0.5;
        break;
      case "min_d":
        demLean = 0.15 + rng(d) * 0.45;
        break;
      case "median":
        demLean = 0.3 + rng(d) * 0.4;
        break;
      case "most_competitive":
        demLean = 0.42 + rng(d) * 0.16;
        break;
      case "least_competitive":
        demLean = rng(d) > 0.5 ? 0.6 + rng(d + 100) * 0.25 : 0.1 + rng(d + 100) * 0.25;
        break;
      case "fewest_county_splits":
      case "most_county_splits":
        demLean = 0.25 + rng(d) * 0.5;
        break;
      case "max_minority_districts":
        demLean = d <= numDistricts * 0.4 ? 0.55 + rng(d) * 0.3 : 0.2 + rng(d) * 0.35;
        break;
      case "min_minority_districts":
        demLean = 0.2 + rng(d) * 0.55;
        break;
      default:
        demLean = 0.3 + rng(d) * 0.4;
    }
    const isDem = demLean > 0.5;
    const margin = Math.abs(demLean - 0.5) * 100 * 2;
    districts.push({
      district: d,
      party: isDem ? "Democrat" : "Republican",
      vote_margin_pct: Math.round(margin * 10) / 10,
    });
  }
  return districts;
}
