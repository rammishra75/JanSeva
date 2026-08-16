const STAGES = ['created', 'acknowledged', 'in_progress', 'resolved', 'verified'];

const STAGE_LABELS = {
  created: 'Reported',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  verified: 'Verified',
  reopened: 'Reopened'
};

function formatDuration(ms) {
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(ms / 60000)}m`;
}

export default function LifecycleTimeline({ lifecycle = [], durations = [], currentStatus }) {
  const stageIndex = STAGES.indexOf(
    currentStatus === 'reopened' ? 'in_progress' : currentStatus === 'open' ? 'created' : currentStatus
  );

  return (
    <div className="lifecycle">
      {STAGES.map((stage, i) => {
        const entry = lifecycle.find(l => l.stage === stage);
        const duration = durations.find(d => d.stage === stage);
        const isCompleted = i < stageIndex || (entry && entry.exitedAt);
        const isCurrent = i === stageIndex || (entry && !entry.exitedAt);

        return (
          <div key={stage} className={`lifecycle-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
            <div className="lifecycle-dot">{i + 1}</div>
            <div className="step-label">{STAGE_LABELS[stage]}</div>
            {duration && (
              <div className="step-duration">{formatDuration(duration.durationMs)}</div>
            )}
            {entry?.department && (
              <div className="step-duration">{entry.department}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
