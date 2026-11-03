import React from 'react';

export interface PriorityReportRow {
  attribute: string;
  weight: number | null;
  min: number | null;
  max: number | null;
  excluded: boolean;
  final: number;
  minMet: boolean | null;
  pointsAdded: number;
  apSpent: number;
}

interface Props {
  report: PriorityReportRow[] | null | undefined;
  onDismiss?: () => void;
}

export const PriorityReportCard: React.FC<Props> = ({ report, onDismiss }) => {
  if (!report || report.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#26334A] bg-[#0D1220] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-bold text-[#8E9AAF] uppercase tracking-widest">Priority Results</span>
        {onDismiss && (
          <button onClick={onDismiss} className="text-[#8E9AAF] text-xs" aria-label="Dismiss">✕</button>
        )}
      </div>
      <div className="space-y-1">
        {report.map(r => (
          <div key={r.attribute} className="flex items-center justify-between text-[10px]">
            <span className="text-[#F4F7FB] font-semibold truncate pr-2">{r.attribute}</span>
            <span className="flex items-center gap-2 shrink-0">
              {r.minMet !== null && (
                <span className={r.minMet ? 'text-[#21E6A4] font-bold' : 'text-[#ff8a8a] font-bold'}>
                  {r.minMet ? `✓ min ${r.min}` : `✗ min ${r.min}`}
                </span>
              )}
              {r.max !== null && <span className="text-[#8E9AAF]">max {r.max}</span>}
              {r.excluded && <span className="text-[#8E9AAF]">skipped{r.pointsAdded > 0 ? ' (used last)' : ''}</span>}
              <span className="text-[#facc15] font-black w-6 text-right">{r.final}</span>
            </span>
          </div>
        ))}
      </div>
      {report.some(r => r.minMet === false) && (
        <p className="mt-2 text-[10px] text-[#8E9AAF] leading-relaxed">
          Some minimums weren't reached: not enough AP, or a cap or ceiling got in the way.
        </p>
      )}
    </div>
  );
};
