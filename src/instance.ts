import {
	CardGenerator,
	HostCapabilities,
	SurfaceDrawProps,
	SurfaceContext,
	SurfaceInstance,
	createModuleLogger,
	ModuleLogger,
} from '@companion-surface/base'
import { type Shuttle } from 'shuttle-node'
import { buttonToId, xyToId } from './util.js'
import { ShuttleModelInfo } from './models.js'

export class ContourShuttleWrapper implements SurfaceInstance {
	readonly #logger: ModuleLogger

	readonly #contourShuttle: Shuttle
	readonly #modelInfo: ShuttleModelInfo

	readonly #surfaceId: string
	readonly #context: SurfaceContext

	#shuttleRing: { val: number; interval: ReturnType<typeof setInterval> | undefined }

	public get surfaceId(): string {
		return this.#surfaceId
	}
	public get productName(): string {
		return this.#contourShuttle.info.name
	}

	public constructor(surfaceId: string, shuttle: Shuttle, info: ShuttleModelInfo, context: SurfaceContext) {
		this.#logger = createModuleLogger(`Instance/${surfaceId}`)
		this.#contourShuttle = shuttle
		this.#modelInfo = info
		this.#surfaceId = surfaceId
		this.#context = context

		this.#shuttleRing = { val: 0, interval: undefined }

		this.#contourShuttle.on('error', (error) => {
			console.error(error)
			this.#clearRepeatingActions()
			this.#context.disconnect(error)
		})

		this.#contourShuttle.on('down', (info) => {
			const id = buttonToId(this.#modelInfo, info)
			if (!id) return

			this.#context.keyDownById(id)
		})

		this.#contourShuttle.on('up', (info) => {
			const id = buttonToId(this.#modelInfo, info)
			if (!id) return

			this.#context.keyUpById(id)
		})

		const rotate = (id: string | undefined, isRightward: boolean) => {
			if (!id) return

			if (isRightward) {
				this.#context.rotateRightById(id)
			} else {
				this.#context.rotateLeftById(id)
			}
		}

		this.#contourShuttle.on('jog', (delta) => {
			const xy = this.#modelInfo.jog
			if (!xy) return

			//console.log(`Jog position has changed`, delta)
			this.#logger.debug(`Setting jog variable to ${delta}`)
			this.#context.sendVariableValue('jogValueVariable', delta)
			setTimeout(() => {
				this.#context.sendVariableValue('jogValueVariable', 0)
			}, 20)

			rotate(xyToId(xy), delta == 1)
		})

		this.#contourShuttle.on('shuttle', (shuttle) => {
			const shuttleInfo = this.#shuttleRing
			// Fibonacci sequence provides nice acceleration: small changes at first then larger changes
			// could be an array constant but is more resilient this way
			// For 7 values: [1, 2, 3, 5, 8, 13, 21]
			const fibonacci = (n: number) => {
				let f = [0, 1]
				for (let c = 1; c < n; c++) {
					f = [f[1], f[0] + f[1]]
				}
				return f[1]
			}
			const xy = this.#modelInfo.shuttle
			const xyRepeating = this.#modelInfo.shuttleRepeating
			if (!xy || !xyRepeating) {
				return
			}

			// do this before emitting any events:
			this.#logger.debug(`Setting shuttle variable to ${shuttle}`)
			this.#context.sendVariableValue('shuttleValueVariable', shuttle)

			// Direction of rotation events (true triggers "rotate-right") is different than for knobs
			// because the ring has limited travel and always springs back to zero. In typical usage,
			// a shuttle-ring emits "go forward" commands if shuttle > 0 and "reverse" commands when
			// it's on the negative side of zero, regardless of direction of rotation.
			// So we define "rotate-right/left" here to mean right/left side of zero (i.e. positive/negative values)
			const isRightward = shuttle > 0 || shuttleInfo.val > 0

			const id = xy ? xyToId(xy) : undefined
			const idRepeating = xyRepeating ? xyToId(xyRepeating) : undefined

			const firstAction = shuttleInfo.interval == undefined // must be stored before clearRepeatingActions()
			this.#clearRepeatingActions()
			rotate(id, isRightward) // always emit a single non-repeating event

			// repeating events:
			// Note:
			// If shuttle is zero, user released the spring-loaded ring and we're done (and shouldn't emit an action)
			// The interval has already been cleared, above.
			// Unfortunately, there's no equivalent of button-release on rotation actions
			// So if the user needs to react to shuttle-ring release, they will have to add logic
			// to the non-repeating button for shuttle===0. (Maybe we add a feedback? internal:shuttle-released?
			// ...Or a 'shuttle-released' variable similar to the 'jog' variable above ???)
			if (firstAction) {
				// when user moves off of zero, issue the first rotation action immediately
				rotate(idRepeating, isRightward)
			}

			if (shuttle !== 0) {
				// repeat rate increases as shuttle ring is rotated in further either direction. (shuttle varies from 1-7)
				shuttleInfo.interval = setInterval(
					() => {
						rotate(idRepeating, isRightward)
					},
					1000 / fibonacci(Math.abs(shuttle)),
				) // vary from 1 to 21 reps/second (roughly 1000 - 50 ms intervals)
			}
			shuttleInfo.val = shuttle
		})

		// clear shuttle-ring activity.
		this.#contourShuttle.on('disconnected', () => {
			this.#clearRepeatingActions()
			this.#context.disconnect(new Error('Device disconnected'))
		})
	}

	#clearRepeatingActions(): void {
		const shuttleInfo = this.#shuttleRing
		if (shuttleInfo.interval !== undefined) {
			clearInterval(shuttleInfo.interval)
			shuttleInfo.interval = undefined
		}
	}

	async init(): Promise<void> {
		// Nothing to do
	}
	async close(): Promise<void> {
		this.#clearRepeatingActions()
		this.#contourShuttle.close().catch((e) => {
			this.#logger.error(`Failed to close contour shuttle: ${e}`)
		})
	}

	updateCapabilities(_capabilities: HostCapabilities): void {
		// Not used
	}

	async ready(): Promise<void> {
		// Nothing to do
	}

	async setBrightness(_percent: number): Promise<void> {
		// Not used
	}
	async blank(): Promise<void> {
		// Not used
	}
	async draw(_signal: AbortSignal, _drawProps: SurfaceDrawProps): Promise<void> {
		// Not used
	}
	async showStatus(_signal: AbortSignal, _cardGenerator: CardGenerator): Promise<void> {
		// Not used
	}
}
