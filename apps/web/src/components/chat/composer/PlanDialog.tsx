'use client';

import React, { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import type { ChatPlanPayload } from '@/types/chat';
import { DialogShell, FIELD_CLASS, LABEL_CLASS, PRIMARY_BTN, SECONDARY_BTN } from './DialogShell';

export const PlanDialog: React.FC<{ onSend: (plan: ChatPlanPayload) => void; onClose: () => void }> = ({ onSend, onClose }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('This Friday');
  const [time, setTime] = useState('9:00 PM');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSend({ planId: `plan-${Date.now()}`, title: title.trim(), scheduledAt: date, time, status: 'upcoming' });
    onClose();
  };

  return (
    <DialogShell label="Create watch plan" onClose={onClose} onSubmit={submit} panelClassName="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#ee1d49]" />
          <span>Create Watch Plan</span>
        </h3>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label className={LABEL_CLASS}>Plan Name</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 🍿 Friday Movie Night" required maxLength={80} autoFocus className={FIELD_CLASS} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL_CLASS}>Date</label>
          <input type="text" value={date} onChange={(e) => setDate(e.target.value)} placeholder="e.g. Friday" maxLength={40} className={FIELD_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Time</label>
          <input type="text" value={time} onChange={(e) => setTime(e.target.value)} placeholder="e.g. 9:00 PM" maxLength={20} className={FIELD_CLASS} />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onClose} className={SECONDARY_BTN}>Cancel</button>
        <button type="submit" className={PRIMARY_BTN}>Share Plan</button>
      </div>
    </DialogShell>
  );
};
