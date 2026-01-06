'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface ActivityChartProps {
  data: Array<{
    date: string;
    count: number;
  }>;
}

export function ActivityChart({ data }: ActivityChartProps) {
  const maxCount = useMemo(() => Math.max(...data.map((d) => d.count), 1), [data]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-1 h-24">
        {data.map((item, index) => {
          const heightPercent = (item.count / maxCount) * 100;
          return (
            <div key={index} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full relative group">
                <div
                  className={cn(
                    'w-full rounded-t-sm transition-all duration-300 hover:opacity-80',
                    item.count > 0 ? 'bg-primary' : 'bg-muted'
                  )}
                  style={{ height: `${Math.max(heightPercent, 4)}%`, minHeight: item.count > 0 ? '8px' : '4px' }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border rounded shadow-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {item.count} action{item.count !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        {data.map((item, index) => (
          <span key={index} className="flex-1 text-center">
            {formatDate(item.date)}
          </span>
        ))}
      </div>
    </div>
  );
}

// Generate mock data for the last 7 days
export function generateActivityData(activities: Array<{ createdAt: string }>): Array<{ date: string; count: number }> {
  const result: Array<{ date: string; count: number }> = [];
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    
    const count = activities.filter((a) => {
      const activityDate = new Date(a.createdAt);
      return activityDate >= date && activityDate < nextDate;
    }).length;
    
    result.push({
      date: date.toISOString().split('T')[0],
      count,
    });
  }
  
  return result;
}



