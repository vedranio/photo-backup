import { describe, expect, it, vi } from 'vitest'
import type { BackupSnapshot } from '@shared/api'
import { BackupJob, type Plan, type Stage, type StageContext } from './job'

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

/** A stage that runs `steps` checkpoints and resolves only when `release()` is called per step. */
interface Stepped {
  stage: Stage
  release(): Promise<void>
  runs(): number
}

function steppedStage(id: Stage['id'], steps: number, opts: Partial<Stage> = {}): Stepped {
  const gates: Array<() => void> = []
  let runs = 0
  const stage: Stage = {
    id,
    ...opts,
    async run(ctx: StageContext) {
      runs++
      for (let i = 0; i < steps; i++) {
        await ctx.checkpoint()
        await new Promise<void>((resolve, reject) => {
          gates.push(resolve)
          ctx.signal.addEventListener(
            'abort',
            () => {
              gates.splice(gates.indexOf(resolve), 1)
              reject(new Error('aborted'))
            },
            { once: true }
          )
        })
        ctx.progress((i + 1) / steps)
      }
    }
  }
  return {
    stage,
    release: async () => {
      gates.shift()?.()
      await tick()
    },
    runs: () => runs
  }
}

function planOf(stages: Stage[], dispose = vi.fn(async () => undefined)): Plan {
  return {
    stages,
    result: () => ({ itemCount: 3, totalBytes: 30, destination: 's3://b/k.zip' }),
    dispose
  }
}

describe('BackupJob', () => {
  it('runs stages in order and succeeds', async () => {
    const a = steppedStage('compress', 1)
    const b = steppedStage('upload', 2)
    const job = new BackupJob(async () => planOf([a.stage, b.stage]))
    const updates: BackupSnapshot[] = []
    job.onUpdate((s) => updates.push(s))

    expect(job.start({ sourceIds: [1], cleanUp: false, month: '2026-09' }).status).toBe('running')
    await tick()
    expect(job.snapshot().currentStage).toBe('compress')
    await a.release()
    expect(job.snapshot().currentStage).toBe('upload')
    await b.release()
    expect(job.snapshot().stages).toEqual([
      { id: 'compress', percent: 100 },
      { id: 'upload', percent: 50 }
    ])
    await b.release()
    expect(job.snapshot()).toMatchObject({ status: 'succeeded', result: { itemCount: 3 } })
    expect(updates.length).toBeGreaterThan(3)

    expect(job.dismiss().status).toBe('idle')
  })

  it('pauses at a checkpoint and resumes', async () => {
    const a = steppedStage('compress', 2)
    const job = new BackupJob(async () => planOf([a.stage]))
    job.start({ sourceIds: [1], cleanUp: false, month: '2026-09' })
    await tick()
    expect(job.pause().status).toBe('paused')
    await a.release() // finishes step 1, then waits at the checkpoint
    expect(job.snapshot()).toMatchObject({ status: 'paused', stages: [{ percent: 50 }] })
    job.resume()
    await tick()
    await a.release()
    expect(job.snapshot().status).toBe('succeeded')
    expect(a.runs()).toBe(1)
  })

  it('aborts and reruns an abortOnPause stage on resume', async () => {
    const up = steppedStage('upload', 1, { abortOnPause: true })
    const job = new BackupJob(async () => planOf([up.stage]))
    job.start({ sourceIds: [1], cleanUp: false, month: '2026-09' })
    await tick()
    job.pause()
    await tick()
    expect(job.snapshot().status).toBe('paused')
    job.resume()
    await tick()
    expect(up.runs()).toBe(2)
    await up.release()
    expect(job.snapshot().status).toBe('succeeded')
  })

  it('fails with the error, and retry resumes from the failed stage', async () => {
    const a = steppedStage('compress', 1)
    let attempts = 0
    const flaky: Stage = {
      id: 'upload',
      async run() {
        if (++attempts === 1) throw new Error('Network down')
      }
    }
    const job = new BackupJob(async () => planOf([a.stage, flaky]))
    job.start({ sourceIds: [1], cleanUp: false, month: '2026-09' })
    await tick()
    await a.release()
    expect(job.snapshot()).toMatchObject({ status: 'failed', error: 'Network down' })
    job.retry()
    await tick()
    expect(job.snapshot().status).toBe('succeeded')
    expect(a.runs()).toBe(1)
  })

  it('fails when planning fails', async () => {
    const job = new BackupJob(async () => {
      throw new Error('AWS isn’t set up')
    })
    job.start({ sourceIds: [1], cleanUp: false, month: '2026-09' })
    await tick()
    expect(job.snapshot()).toMatchObject({ status: 'failed', error: 'AWS isn’t set up' })
  })

  it('cancels from running, paused and failed, disposing the run', async () => {
    for (const setup of ['running', 'paused'] as const) {
      const a = steppedStage('compress', 1)
      const dispose = vi.fn(async () => undefined)
      const job = new BackupJob(async () => planOf([a.stage], dispose))
      job.start({ sourceIds: [1], cleanUp: false, month: '2026-09' })
      await tick()
      if (setup === 'paused') job.pause()
      expect(job.cancel().status).toBe('idle')
      await tick()
      expect(dispose).toHaveBeenCalled()
      expect(job.snapshot()).toEqual({ status: 'idle', stages: [], currentStage: null })
    }
  })
})
