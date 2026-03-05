import React, { useState } from 'react';

const UptimeTimeline = ({ dailyStatus = [] }) => {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    // Calculate uptime percentage
    const operationalDays = dailyStatus.filter(d => d.status === 'operational').length;
    const uptimePercent = dailyStatus.length > 0
        ? ((operationalDays / dailyStatus.length) * 100).toFixed(1)
        : '—';

    const formatDate = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const statusLabel = (status) => {
        switch (status) {
            case 'operational': return 'Operational';
            case 'degraded': return 'Degraded Performance';
            case 'outage': return 'Major Outage';
            default: return 'No Data';
        }
    };

    return (
        <div className="uptime-timeline">
            <div className="uptime-timeline-header">
                <span className="uptime-timeline-label">14-day uptime</span>
                <span className="uptime-timeline-percentage">{uptimePercent}%</span>
            </div>
            <div className="uptime-timeline-bar">
                {dailyStatus.map((day, i) => (
                    <div
                        key={day.date}
                        className={`uptime-segment ${day.status}`}
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                    >
                        {hoveredIndex === i && (
                            <div className="uptime-tooltip">
                                <div className="uptime-tooltip-date">{formatDate(day.date)}</div>
                                <div className="uptime-tooltip-status">
                                    {statusLabel(day.status)}
                                    {day.incidentCount > 0 && ` (${day.incidentCount} incident${day.incidentCount > 1 ? 's' : ''})`}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default UptimeTimeline;
