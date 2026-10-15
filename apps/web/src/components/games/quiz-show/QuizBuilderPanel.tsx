'use client';

import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, ListPlus, Pencil, Plus, Trash2, Wand2, X } from 'lucide-react';
import {
  QUIZ_ANSWER_MAX,
  QUIZ_MAX_OPTIONS,
  QUIZ_MAX_QUESTIONS,
  QUIZ_MIN_OPTIONS,
  QUIZ_NOTE_MAX,
  QUIZ_OPTION_MAX,
  QUIZ_POINT_VALUES,
  QUIZ_TEXT_MAX,
  QUIZ_TIME_LIMITS
} from '@synccinema/common';
import type { QuizQuestion, QuizQuestionType } from '@synccinema/common';
import { blankQuestion, canAddQuestion, optionStyle, questionPayload, validateQuestion, type EditorQuestion } from '../../../lib/quizShowView';

const CARD = 'rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4';
const LABEL = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const FIELD = 'w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#ee1d49] focus-visible:ring-2 focus-visible:ring-[#ee1d49]/30 dark:border-white/10 dark:bg-[#0c0d12] dark:text-white dark:placeholder-zinc-500';
const ICON_BTN = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-[#22232c] dark:hover:text-white';

function toEditor(q: QuizQuestion): EditorQuestion {
  return { type: q.type, text: q.text, options: [...q.options], correctIndex: q.correctIndex, timeLimitSec: q.timeLimitSec, points: q.points, note: q.note };
}

function Segmented<T extends string | number>({ label, value, options, onChange, format }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void; format?: (v: T) => string }) {
  return (
    <div>
      <span className={LABEL}>{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-zinc-100 p-0.5 dark:bg-[#22232c]">
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            role="radio"
            aria-checked={value === o}
            onClick={() => onChange(o)}
            className={`h-7 rounded-lg px-3 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] ${value === o ? 'bg-white text-zinc-900 ring-1 ring-zinc-200 dark:bg-[#ee1d49] dark:text-white dark:ring-0' : 'text-zinc-600 dark:text-zinc-300'}`}
          >
            {format ? format(o) : String(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

interface QuizBuilderPanelProps {
  draft: QuizQuestion[];
  /** sends one `quiz-show:edit` message */
  onEdit: (payload: Record<string, unknown>) => void;
  error?: string | null;
}

/** The host's quiz builder in the waiting lobby: the question list (move / edit / delete), the editor and the starter pack. */
export const QuizBuilderPanel: React.FC<QuizBuilderPanelProps> = ({ draft, onEdit, error }) => {
  const [editing, setEditing] = useState<{ id: string | null; q: EditorQuestion } | null>(null);
  const [confirmStarter, setConfirmStarter] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const problems = useMemo(() => (editing ? validateQuestion(editing.q) : []), [editing]);

  const start = (q: EditorQuestion, id: string | null) => { setEditing({ id, q }); setSubmitted(false); };
  const patch = (p: Partial<EditorQuestion>) => setEditing((e) => (e ? { ...e, q: { ...e.q, ...p } } : e));
  const setType = (type: QuizQuestionType) => {
    if (!editing || editing.q.type === type) return;
    const fresh = blankQuestion(type);
    patch({ type, options: fresh.options, correctIndex: fresh.correctIndex, timeLimitSec: fresh.timeLimitSec });
  };
  const setOption = (i: number, v: string) => editing && patch({ options: editing.q.options.map((o, j) => (j === i ? v : o)) });
  const addOption = () => editing && editing.q.options.length < QUIZ_MAX_OPTIONS && patch({ options: [...editing.q.options, ''] });
  const removeOption = (i: number) => {
    if (!editing || editing.q.options.length <= QUIZ_MIN_OPTIONS) return;
    const options = editing.q.options.filter((_, j) => j !== i);
    const c = editing.q.correctIndex;
    patch({ options, correctIndex: c === i ? 0 : c > i ? c - 1 : c });
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSubmitted(true);
    if (problems.length > 0) return;
    const question = questionPayload(editing.q);
    onEdit(editing.id ? { op: 'update', id: editing.id, question } : { op: 'add', question });
    setEditing(null);
  };

  const loadStarter = () => {
    if (draft.length > 0 && !confirmStarter) { setConfirmStarter(true); return; }
    onEdit({ op: 'starter' });
    setConfirmStarter(false);
    setEditing(null);
  };

  return (
    <div className={`${CARD} space-y-3`} data-testid="quiz-builder">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white sm:text-base">Quiz builder</h2>
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400" data-testid="quiz-count">
            {draft.length} of {QUIZ_MAX_QUESTIONS} questions. Only you see the answers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={loadStarter} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]">
            <Wand2 className="h-3.5 w-3.5" />
            {confirmStarter ? 'Replace my questions?' : 'Movie Night starter pack'}
          </button>
          {confirmStarter && (
            <button type="button" onClick={() => setConfirmStarter(false)} className="h-8 rounded-xl px-2.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:text-zinc-300 dark:hover:bg-[#22232c]">Cancel</button>
          )}
          <button type="button" onClick={() => start(blankQuestion(), null)} disabled={!canAddQuestion(draft.length)} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#ee1d49] px-3 text-xs font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-[#14151b]">
            <Plus className="h-3.5 w-3.5" />
            Add question
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        {/* QUESTION LIST */}
        <div>
          {draft.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 px-3 py-8 text-center dark:border-white/15">
              <ListPlus className="mb-2 h-6 w-6 text-zinc-400" />
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">No questions yet</p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Add your own, or start from the Movie Night starter pack.</p>
            </div>
          ) : (
            <ol className="max-h-80 space-y-1.5 overflow-y-auto pr-1 scrollbar-none" aria-label="Questions">
              {draft.map((q, i) => (
                <li key={q.id} className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${editing?.id === q.id ? 'border-[#ee1d49]' : 'border-zinc-200 dark:border-white/10'} bg-zinc-50 dark:bg-[#1b1c24]`}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-200 text-[11px] font-bold text-zinc-700 dark:bg-[#22232c] dark:text-zinc-200">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-zinc-900 dark:text-white">{q.text}</p>
                    <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                      {q.type === 'BUZZER' ? 'Buzzer' : `Multiple choice, ${q.timeLimitSec} s`} · {q.points} pts
                    </p>
                  </div>
                  <button type="button" className={ICON_BTN} onClick={() => onEdit({ op: 'move', id: q.id, direction: 'up' })} disabled={i === 0} aria-label={`Move question ${i + 1} up`}><ChevronUp className="h-4 w-4" /></button>
                  <button type="button" className={ICON_BTN} onClick={() => onEdit({ op: 'move', id: q.id, direction: 'down' })} disabled={i === draft.length - 1} aria-label={`Move question ${i + 1} down`}><ChevronDown className="h-4 w-4" /></button>
                  <button type="button" className={ICON_BTN} onClick={() => start(toEditor(q), q.id)} aria-label={`Edit question ${i + 1}`}><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" className={`${ICON_BTN} hover:text-red-700 dark:hover:text-red-400`} onClick={() => { onEdit({ op: 'delete', id: q.id }); if (editing?.id === q.id) setEditing(null); }} aria-label={`Delete question ${i + 1}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* EDITOR */}
        <div>
          {editing ? (
            <form onSubmit={save} className="space-y-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-[#1b1c24]" data-testid="quiz-editor" noValidate>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-900 dark:text-white">{editing.id ? 'Edit question' : 'New question'}</h3>
                <button type="button" onClick={() => setEditing(null)} className={ICON_BTN} aria-label="Close editor"><X className="h-4 w-4" /></button>
              </div>

              <Segmented<QuizQuestionType> label="Type" value={editing.q.type} options={['MULTIPLE_CHOICE', 'BUZZER']} onChange={setType} format={(v) => (v === 'BUZZER' ? 'Buzzer' : 'Multiple choice')} />

              <div>
                <label htmlFor="quiz-q-text" className={LABEL}>Question ({editing.q.text.length}/{QUIZ_TEXT_MAX})</label>
                <textarea id="quiz-q-text" value={editing.q.text} onChange={(e) => patch({ text: e.target.value })} rows={2} maxLength={QUIZ_TEXT_MAX} className={`${FIELD} resize-none py-2`} placeholder="Type your question" />
              </div>

              {editing.q.type === 'MULTIPLE_CHOICE' && (
                <fieldset>
                  <legend className={LABEL}>Options (tap the dot for the correct one)</legend>
                  <div className="space-y-1.5">
                    {editing.q.options.map((o, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          role="radio"
                          aria-checked={editing.q.correctIndex === i}
                          aria-label={`Option ${optionStyle(i).letter} is correct`}
                          onClick={() => patch({ correctIndex: i })}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-1 ${optionStyle(i).bg} ${editing.q.correctIndex === i ? 'ring-2 ring-zinc-900 ring-offset-1 dark:ring-white' : 'opacity-70'}`}
                        >
                          {editing.q.correctIndex === i ? <Check className="h-4 w-4" /> : optionStyle(i).letter}
                        </button>
                        <input value={o} onChange={(e) => setOption(i, e.target.value)} maxLength={QUIZ_OPTION_MAX} aria-label={`Option ${optionStyle(i).letter}`} placeholder={`Option ${optionStyle(i).letter}`} className={`${FIELD} h-8`} />
                        <button type="button" className={ICON_BTN} onClick={() => removeOption(i)} disabled={editing.q.options.length <= QUIZ_MIN_OPTIONS} aria-label={`Remove option ${optionStyle(i).letter}`}><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                  {editing.q.options.length < QUIZ_MAX_OPTIONS && (
                    <button type="button" onClick={addOption} className="mt-1.5 inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:text-zinc-200 dark:hover:bg-[#22232c]">
                      <Plus className="h-3.5 w-3.5" /> Add option
                    </button>
                  )}
                </fieldset>
              )}

              <div className="flex flex-wrap gap-3">
                {editing.q.type === 'MULTIPLE_CHOICE' && (
                  <Segmented<number> label="Time limit" value={editing.q.timeLimitSec} options={QUIZ_TIME_LIMITS} onChange={(v) => patch({ timeLimitSec: v })} format={(v) => `${v} s`} />
                )}
                <Segmented<number> label="Points" value={editing.q.points} options={QUIZ_POINT_VALUES} onChange={(v) => patch({ points: v })} />
              </div>

              <div>
                <label htmlFor="quiz-q-note" className={LABEL}>{editing.q.type === 'BUZZER' ? 'Answer for you (host only until the reveal)' : 'Host note (optional, host only until the reveal)'}</label>
                <input id="quiz-q-note" value={editing.q.note} onChange={(e) => patch({ note: e.target.value })} maxLength={QUIZ_NOTE_MAX} className={`${FIELD} h-8`} placeholder={editing.q.type === 'BUZZER' ? 'The accepted answer' : 'A fun fact, shown with the answer'} />
              </div>
              {editing.q.type === 'BUZZER' && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Players buzz in; the first gets 15 seconds to answer (up to {QUIZ_ANSWER_MAX} characters) and you mark it Correct or Wrong. A wrong answer costs half the points.</p>
              )}

              {submitted && problems.length > 0 && (
                <ul role="alert" className="space-y-0.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">
                  {problems.map((p) => <li key={p}>{p}</li>)}
                </ul>
              )}

              <div className="flex gap-2">
                <button type="submit" className="h-9 flex-1 rounded-xl bg-[#ee1d49] text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1b1c24]">
                  {editing.id ? 'Save question' : 'Add question'}
                </button>
                <button type="button" onClick={() => setEditing(null)} className="h-9 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:text-white dark:hover:bg-[#22232c]">Cancel</button>
              </div>
            </form>
          ) : (
            <div className="flex h-full min-h-[8rem] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-zinc-500 dark:border-white/15 dark:text-zinc-400">
              <Pencil className="mb-2 h-5 w-5 text-zinc-400" />
              Pick a question to edit it, or add a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/** What players see in the lobby instead of the builder. */
export const QuizPlayerLobbyPanel: React.FC<{ questionCount: number; hostName: string }> = ({ questionCount, hostName }) => (
  <div className={`${CARD} flex items-center gap-3`} data-testid="quiz-waiting-host">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-[#ee1d49] dark:bg-[#22232c]">
      <ListPlus className="h-[18px] w-[18px]" />
    </span>
    <div className="min-w-0">
      <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Waiting for the host</h2>
      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        {hostName} is getting the quiz ready. {questionCount === 0 ? 'No questions yet.' : `${questionCount} ${questionCount === 1 ? 'question' : 'questions'} so far.`}
      </p>
    </div>
  </div>
);

export default QuizBuilderPanel;
