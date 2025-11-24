import type { ShuttleModelInfo } from './models.js'

export function buttonToId(modelInfo: ShuttleModelInfo, info: number): string | undefined {
	const xy = modelInfo.buttons[info]
	if (!xy) return undefined

	return xyToId(xy)
}
export function xyToId(xy: [number, number]): string {
	return `${xy[1]}/${xy[0]}`
}
