import type { SurfaceSchemaLayoutDefinition } from '@companion-surface/base'
import { xyToId } from './util.js'
import type { ShuttleModelInfo } from './models.js'

export function createSurfaceSchema(info: ShuttleModelInfo): SurfaceSchemaLayoutDefinition {
	const surfaceLayout: SurfaceSchemaLayoutDefinition = {
		stylePresets: {
			default: {
				// No feedback for anything
			},
		},
		controls: {},
	}

	const doXy = (xy: [number, number] | undefined) => {
		if (!xy) return

		surfaceLayout.controls[xyToId(xy)] = {
			row: xy[1],
			column: xy[0],
		}
	}

	for (const xy of info.buttons) doXy(xy)
	doXy(info.jog)
	doXy(info.shuttle)
	doXy(info.shuttleRepeating)

	return surfaceLayout
}
