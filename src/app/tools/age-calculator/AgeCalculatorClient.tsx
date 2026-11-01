'use client';

import React, { useState } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import { Calendar, Cake, Clock, Heart, Hourglass } from 'lucide-react';

interface AgeResult {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalWeeks: number;
  nextBirthdayDays: number;
}

function calcAge(dob: Date, target: Date): AgeResult {
  let years = target.getFullYear() - dob.getFullYear();
  let months = target.getMonth() - dob.getMonth();
  let days = target.getDate() - dob.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(target.getFullYear(), target.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const diffMs = Math.max(0, target.getTime() - dob.getTime());
  const totalDays = Math.floor(diffMs / 86400000);
  const totalWeeks = Math.floor(totalDays / 7);
  const totalHours = totalDays * 24;
  const totalMinutes = totalHours * 60;

  const nextBd = new Date(target.getFullYear(), dob.getMonth(), dob.getDate());
  if (nextBd <= target) nextBd.setFullYear(target.getFullYear() + 1);
  const nextBirthdayDays = Math.ceil((nextBd.getTime() - target.getTime()) / 86400000);

  return { years, months, days, totalDays, totalHours, totalMinutes, totalWeeks, nextBirthdayDays };
}

export default function AgeCalculatorClient() {
  const [dob, setDob] = useState('2000-01-01');
  const today = new Date().toISOString().split('T')[0];
  const [targetDate, setTargetDate] = useState(today);

  const result: AgeResult | null =
    dob && targetDate ? calcAge(new Date(dob), new Date(targetDate)) : null;

  return (
    <ToolLayout toolId="age-calculator">
      <div className="max-w-3xl space-y-6">
        {/* Date Inputs Card */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
            Date Parameters
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Date of Birth</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={today}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Age As Of Date</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
              />
            </div>
          </div>
        </div>

        {/* Primary Age Display */}
        {result && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Hero age card */}
            <div className="p-6 rounded-xl border border-border bg-card shadow-2xs text-center space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Exact Chronological Age
              </span>
              <div className="flex items-center justify-center gap-3 sm:gap-6 flex-wrap">
                <div>
                  <span className="text-3xl sm:text-5xl font-black text-primary font-mono tabular-nums">
                    {result.years}
                  </span>
                  <span className="text-xs text-muted-foreground block mt-1 font-medium">Years</span>
                </div>
                <span className="text-2xl text-muted-foreground/40 font-light">•</span>
                <div>
                  <span className="text-3xl sm:text-5xl font-black text-foreground font-mono tabular-nums">
                    {result.months}
                  </span>
                  <span className="text-xs text-muted-foreground block mt-1 font-medium">Months</span>
                </div>
                <span className="text-2xl text-muted-foreground/40 font-light">•</span>
                <div>
                  <span className="text-3xl sm:text-5xl font-black text-foreground font-mono tabular-nums">
                    {result.days}
                  </span>
                  <span className="text-xs text-muted-foreground block mt-1 font-medium">Days</span>
                </div>
              </div>

              {/* Next birthday notification */}
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Cake className="w-3.5 h-3.5" /> Next birthday in {result.nextBirthdayDays} days
                </span>
              </div>
            </div>

            {/* Lifetime stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Days', value: result.totalDays.toLocaleString() },
                { label: 'Total Weeks', value: result.totalWeeks.toLocaleString() },
                { label: 'Total Hours', value: result.totalHours.toLocaleString() },
                { label: 'Total Minutes', value: result.totalMinutes.toLocaleString() },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="p-4 rounded-xl border border-border bg-card shadow-2xs text-center flex flex-col justify-center"
                >
                  <span className="text-lg sm:text-xl font-bold text-foreground font-mono tabular-nums">
                    {value}
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
