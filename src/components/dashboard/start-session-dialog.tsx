"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Play, Timer } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Badge, Button, Field, Select, cn } from "@/components/ui/primitives";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { PRIORITY, TASK_STATUS } from "@/lib/labels";
import { announceSessionChange } from "@/components/session-indicator";

interface TaskOption {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  resource: string | null;
}

export function StartSessionButton({
  tasks,
  defaultOpen = false,
  label = "Demarrer une session",
  size = "md",
  variant = "primary",
  idleMinutes = 15,
}: {
  tasks: TaskOption[];
  defaultOpen?: boolean;
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "outline";
  idleMinutes?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(defaultOpen);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [idle, setIdle] = React.useState(String(idleMinutes));
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  function toggle(taskId: string) {
    setSelected((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId],
    );
  }

  async function start() {
    setLoading(true);
    try {
      const payload = await apiFetch<{ session: { id: string } }>("/api/sessions", {
        method: "POST",
        body: {
          taskIds: selected,
          idleTimeoutMinutes: Number(idle) || idleMinutes,
        },
      });
      toast.success("Session demarree");
      announceSessionChange();
      router.push(`/editor?session=${payload.session.id}`);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Play className="h-4 w-4" />
        {label}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Demarrer une session de developpement"
        description="Selectionnez les taches sur lesquelles vous allez travailler. Le chronometre est calcule cote serveur."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" onClick={start} loading={loading}>
              <Play className="h-4 w-4" /> Demarrer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-primary-500/20 bg-primary-500/[0.06] px-3 py-2 text-[11px] text-primary-200">
            <Timer className="h-3.5 w-3.5 shrink-0" />
            Une seule session active a la fois. Vous pourrez mettre en pause, changer de tache et
            terminer a tout moment.
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted">Taches a travailler</p>
              <span className="text-[10px] text-muted">{selected.length} selectionnee(s)</span>
            </div>
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {tasks.length === 0 ? (
                <p className="rounded-lg border border-border bg-surface px-3 py-6 text-center text-xs text-muted">
                  Aucune tache ouverte ne vous est assignee. Vous pouvez demarrer une session sans
                  tache et en associer une plus tard.
                </p>
              ) : (
                tasks.map((task) => {
                  const active = selected.includes(task.id);
                  const status = TASK_STATUS[task.status] ?? TASK_STATUS.BACKLOG!;
                  const priority = PRIORITY[task.priority] ?? PRIORITY.MEDIUM!;
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggle(task.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                        active
                          ? "border-primary-500/50 bg-primary-500/10"
                          : "border-border bg-surface hover:border-border-strong",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          active ? "border-primary-400 bg-primary-500 text-white" : "border-border-strong",
                        )}
                      >
                        {active ? <Play className="h-2.5 w-2.5" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="mono text-[10px] text-muted">{task.code}</span>
                          <Badge variant={status.variant}>{status.label}</Badge>
                          <Badge variant={priority.variant}>{priority.label}</Badge>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-fg">{task.title}</span>
                        {task.resource ? (
                          <span className="mt-0.5 block truncate text-[10px] text-muted">
                            {task.resource}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <Field
            label="Detection d'inactivite"
            hint="Un rappel est envoye apres ce delai. Aucun temps n'est retire automatiquement."
          >
            <Select value={idle} onChange={(event) => setIdle(event.target.value)}>
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  );
}
