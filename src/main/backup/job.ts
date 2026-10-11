// The backup job: a state machine over a run's stages. It knows nothing about Drive, zip or S3;
// a Planner turns a request into stages (see plan.ts).
import type {
  BackupRequest,
  BackupResult,
  BackupSnapshot,
  JobStatus,
  StageId,
  StageProgress
} from '@shared/api'

export interface StageContext {
  /** Aborts on cancel, and on pause for stages with `abortOnPause`. */
  signal: AbortSignal
  /** Call between units of work: waits while paused, throws when cancelled. */
  checkpoint(): Promise<void>
  /** 0–1 */
  progress(fraction: number): void
}

export interface Stage {
  id: StageId
  /** Pausing aborts the stage, and resuming runs it again from the start (e.g. an upload). */
  abortOnPause?: boolean
  run(ctx: StageContext): Promise<void>
}

export interface Plan {
  stages: Stage[]
  result(): BackupResult
  /** Removes temporary files. Called when the run ends for good. */
  dispose(): Promise<void>
}

export type Planner = (request: BackupRequest, signal: AbortSignal) => Promise<Plan>

class Cancelled extends Error {}

interface Run {
  request: BackupRequest
  controller: AbortController
  cancelled: boolean
  plan?: Plan
  /** Index of the stage to run next (or that failed). */
  stageIndex: number
}

export class BackupJob {
  private status: JobStatus = 'idle'
  private stages: StageProgress[] = []
  private currentStage: StageId | null = null
  private result?: BackupResult
  private error?: string
  private run?: Run
  private resumeWaiters: Array<() => void> = []
  private readonly listeners = new Set<(s: BackupSnapshot) => void>()

  constructor(private readonly planner: Planner) {}

  snapshot(): BackupSnapshot {
    return {
      status: this.status,
      stages: this.stages.map((s) => ({ ...s })),
      currentStage: this.currentStage,
      ...(this.result && { result: this.result }),
      ...(this.error && { error: this.error }),
      ...(this.run && { month: this.run.request.month })
    }
  }

  onUpdate(listener: (s: BackupSnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    const snap = this.snapshot()
    for (const l of this.listeners) l(snap)
  }

  start(request: BackupRequest): BackupSnapshot {
    if (this.status === 'running' || this.status === 'paused') return this.snapshot()
    void this.disposeRun()
    this.run = { request, controller: new AbortController(), cancelled: false, stageIndex: 0 }
    this.result = undefined
    this.error = undefined
    this.stages = []
    this.currentStage = null
    this.status = 'running'
    void this.execute(this.run)
    this.emit()
    return this.snapshot()
  }

  pause(): BackupSnapshot {
    if (this.status !== 'running' || !this.run) return this.snapshot()
    this.status = 'paused'
    const stage = this.run.plan?.stages[this.run.stageIndex]
    if (stage?.abortOnPause) this.run.controller.abort()
    this.emit()
    return this.snapshot()
  }

  resume(): BackupSnapshot {
    if (this.status !== 'paused') return this.snapshot()
    this.status = 'running'
    this.wakeWaiters()
    this.emit()
    return this.snapshot()
  }

  /** Runs a failed backup again from the stage that failed. */
  retry(): BackupSnapshot {
    if (this.status !== 'failed' || !this.run) return this.snapshot()
    const run = this.run
    run.controller = new AbortController()
    this.error = undefined
    this.status = 'running'
    void this.execute(run)
    this.emit()
    return this.snapshot()
  }

  cancel(): BackupSnapshot {
    if (this.run) {
      this.run.cancelled = true
      this.run.controller.abort()
    }
    this.wakeWaiters()
    void this.disposeRun()
    this.reset()
    return this.snapshot()
  }

  /** "Done" after a successful backup. */
  dismiss(): BackupSnapshot {
    if (this.status === 'succeeded') this.reset()
    return this.snapshot()
  }

  private reset(): void {
    this.run = undefined
    this.status = 'idle'
    this.stages = []
    this.currentStage = null
    this.result = undefined
    this.error = undefined
    this.emit()
  }

  private wakeWaiters(): void {
    const waiters = this.resumeWaiters
    this.resumeWaiters = []
    waiters.forEach((w) => w())
  }

  private async waitWhilePaused(run: Run): Promise<void> {
    while (this.run === run && this.status === 'paused' && !run.cancelled) {
      await new Promise<void>((resolve) => this.resumeWaiters.push(resolve))
    }
    if (run.cancelled || this.run !== run) throw new Cancelled()
  }

  private async disposeRun(): Promise<void> {
    const plan = this.run?.plan
    if (plan) await plan.dispose().catch(() => undefined)
  }

  private async execute(run: Run): Promise<void> {
    try {
      if (!run.plan) {
        run.plan = await this.planner(run.request, run.controller.signal)
        if (run.cancelled) throw new Cancelled()
        this.stages = run.plan.stages.map((s) => ({ id: s.id, percent: 0 }))
        this.emit()
      }
      const plan = run.plan
      while (run.stageIndex < plan.stages.length) {
        const index = run.stageIndex
        const stage = plan.stages[index]
        this.currentStage = stage.id
        this.setPercent(index, 0)
        try {
          await stage.run({
            signal: run.controller.signal,
            checkpoint: () => this.waitWhilePaused(run),
            progress: (fraction) => {
              if (this.run === run && !run.cancelled) this.setPercent(index, fraction * 100)
            }
          })
          if (run.cancelled) throw new Cancelled()
          this.setPercent(index, 100)
          run.stageIndex++
        } catch (err) {
          if (run.cancelled || this.run !== run) throw new Cancelled()
          if (this.status === 'paused' && stage.abortOnPause) {
            // Aborted by pause: wait, then run the stage again with a fresh signal.
            await this.waitWhilePaused(run)
            run.controller = new AbortController()
            continue
          }
          throw err
        }
      }
      const result = plan.result()
      await plan.dispose().catch(() => undefined)
      if (run.cancelled || this.run !== run) return
      this.result = result
      this.currentStage = null
      this.status = 'succeeded'
      this.emit()
    } catch (err) {
      if (err instanceof Cancelled || run.cancelled || this.run !== run) return
      this.status = 'failed'
      this.error = err instanceof Error ? err.message : String(err)
      this.emit()
    }
  }

  private setPercent(index: number, percent: number): void {
    const stage = this.stages[index]
    if (!stage) return
    const rounded = Math.min(100, Math.max(0, Math.floor(percent)))
    if (stage.percent === rounded) return
    stage.percent = rounded
    this.emit()
  }
}
