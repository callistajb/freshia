export interface HistoryRecord {
  id: string;
  date: string;
  image: string;
  isTracked?: boolean;
  result?: {
    label?: string;
    confidence?: string | number;
    analysis?: {
      freshnessPercentage?: number;
      salvageValue?: string;
      shelfLife?: string;
      recipe?: string;
    };
  };
}

export interface DashboardStats {
  total: number;
  fresh: number;
  rotten: number;
  unknown: number;
  averageFreshness: number;
}

export function calculateDashboardStats(historyArray: HistoryRecord[]): DashboardStats {
  if (!Array.isArray(historyArray) || historyArray.length === 0) {
    return { total: 0, fresh: 0, rotten: 0, unknown: 0, averageFreshness: 0 };
  }

  let freshCount = 0;
  let rottenCount = 0;
  let unknownCount = 0;
  let totalFreshness = 0;
  let analyzedCount = 0;

  for (const item of historyArray) {
    const label = (item.result?.label || "").toLowerCase();
    const freshness = item.result?.analysis?.freshnessPercentage;

    if (typeof freshness === "number" && !Number.isNaN(freshness)) {
      totalFreshness += freshness;
      analyzedCount++;
    }

    if (
      label.includes("rotten") ||
      label.includes("busuk") ||
      label.includes("layu") ||
      (typeof freshness === "number" && freshness < 40)
    ) {
      rottenCount++;
    } else if (
      label.includes("unknown") ||
      label.includes("gagal") ||
      label.includes("dilewati")
    ) {
      unknownCount++;
    } else {
      freshCount++;
    }
  }

  const averageFreshness = analyzedCount > 0 ? Math.round(totalFreshness / analyzedCount) : 0;

  return {
    total: historyArray.length,
    fresh: freshCount,
    rotten: rottenCount,
    unknown: unknownCount,
    averageFreshness,
  };
}
