export type TrackerEntry = {
  agent: string;
  salesCount: number;
  premiumTotal: number;
  totalLeadCost: number;
  costPerSale: number;
  commissionTotal: number;
};

/** Compute composite performance score: 40% premium (higher=better) + 60% cost efficiency (lower cost=better).
 *  Uses min-max normalization. Agents with no sales get score -1 (rank last). */
export function computeCompositeScores(entries: TrackerEntry[]): (TrackerEntry & { compositeScore: number })[] {
  const withSales = entries.filter(e => e.salesCount > 0);
  const noSales = entries.filter(e => e.salesCount === 0);

  if (withSales.length === 0) return entries.map(e => ({ ...e, compositeScore: -1 }));

  // Premium: higher is better -- min-max normalize to [0,1]
  const premiums = withSales.map(e => e.premiumTotal);
  const minPrem = Math.min(...premiums);
  const maxPrem = Math.max(...premiums);
  const premRange = maxPrem - minPrem || 1;

  // Cost per sale: lower is better (invert). Only agents with actual cost data participate.
  const costs = withSales.filter(e => e.costPerSale > 0).map(e => e.costPerSale);
  const minCost = costs.length > 0 ? Math.min(...costs) : 0;
  const maxCost = costs.length > 0 ? Math.max(...costs) : 1;
  const costRange = maxCost - minCost || 1;

  const scored = withSales.map(e => {
    const premScore = (e.premiumTotal - minPrem) / premRange;
    // No cost data (costPerSale === 0) = worst efficiency (score 0), per D-13
    const costScore = e.costPerSale > 0
      ? 1 - ((e.costPerSale - minCost) / costRange)
      : 0;
    const compositeScore = (premScore * 0.4) + (costScore * 0.6);
    return { ...e, compositeScore };
  });

  const unscoredEntries = noSales.map(e => ({ ...e, compositeScore: -1 }));
  return [...scored, ...unscoredEntries];
}
