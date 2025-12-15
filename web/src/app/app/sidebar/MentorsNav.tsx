"use client";

import { useMemo } from "react";
import { useAssistantApi, useAssistantState } from "@assistant-ui/react";

import { getMentor, MENTORS, type MentorId } from "@/lib/mentors";

export default function MentorsNav({
  activeMentorId,
  onSelectMentor,
  onNavigate,
  canSend,
}: {
  activeMentorId: MentorId;
  onSelectMentor: (id: MentorId) => void;
  onNavigate?: () => void;
  canSend?: boolean;
}) {
  const api = useAssistantApi();
  const isRunning = useAssistantState((s) => s.thread.isRunning);
  const active = useMemo(() => getMentor(activeMentorId), [activeMentorId]);
  const sendEnabled = Boolean(canSend) && !isRunning;

  return (
    <div className="mt-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-[color:rgba(11,18,32,0.60)]">
        Mentors
      </div>

      <div className="mt-2 space-y-1">
        {MENTORS.map((m) => {
          const selected = m.id === activeMentorId;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onSelectMentor(m.id);
                onNavigate?.();
              }}
              className={[
                "block w-full rounded-xl px-3 py-2 text-left text-[12px] font-semibold transition",
                selected
                  ? "border border-[color:rgba(97,106,243,0.24)] bg-[color:rgba(97,106,243,0.10)] text-[color:rgba(11,18,32,0.92)]"
                  : "border border-transparent text-[color:rgba(11,18,32,0.74)] hover:bg-[color:rgba(15,23,42,0.04)]",
              ].join(" ")}
            >
              <div className="truncate">{m.label}</div>
              <div className="mt-0.5 truncate text-[11px] font-medium text-[color:rgba(11,18,32,0.58)]">
                {m.description}
              </div>
            </button>
          );
        })}
      </div>

      {active.quickActions.length > 0 && (
        <div className="mt-3 rounded-xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(15,23,42,0.02)] p-3">
          <div className="text-[11px] font-semibold text-[color:rgba(11,18,32,0.74)]">
            Quick actions
          </div>
          <div className="mt-2 grid gap-2">
            {active.quickActions.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={!sendEnabled}
                onClick={() => {
                  if (!sendEnabled) return;
                  api.composer().setText(a.prompt);
                  api.composer().send();
                  onNavigate?.();
                }}
                className="rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white/85 px-3 py-2 text-left text-[12px] font-semibold text-[color:rgba(11,18,32,0.86)] hover:bg-white disabled:opacity-60"
              >
                {a.label}
              </button>
            ))}
          </div>
          {!canSend && (
            <div className="mt-2 text-[11px] text-[color:rgba(11,18,32,0.58)]">
              Select a chat to run actions.
            </div>
          )}
        </div>
      )}
    </div>
  );
}


