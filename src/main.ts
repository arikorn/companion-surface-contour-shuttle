import {
	assertNever,
	createModuleLogger,
	type DiscoveredSurfaceInfo,
	type HIDDevice,
	type OpenSurfaceResult,
	type SurfaceContext,
	type SurfacePlugin,
} from '@companion-surface/base'
import { isAShuttleDevice, ProductModelId, setupShuttle } from 'shuttle-node'
import { ContourShuttleWrapper } from './instance.js'
import { createSurfaceSchema } from './surface-schema.js'
import {
	contourShuttleProV1Info,
	contourShuttleProV2Info,
	contourShuttleXpressInfo,
	ShuttleModelInfo,
} from './models.js'

const logger = createModuleLogger('Plugin')

const ContourShuttlePlugin: SurfacePlugin<HIDDevice> = {
	init: async (): Promise<void> => {
		// Not used
	},
	destroy: async (): Promise<void> => {
		// Not used
	},

	checkSupportsHidDevice: (device: HIDDevice): DiscoveredSurfaceInfo<HIDDevice> | null => {
		const isShuttle = isAShuttleDevice(device)
		if (!isShuttle) return null

		logger.debug(`Checked HID device: ${device.manufacturer} ${device.product}`)

		return {
			surfaceId: `contourshuttle:${device.serialNumber}`, // Use the faked serial number
			description: `${device.manufacturer} ${device.product || 'Contour Shuttle'}`.trim(),
			pluginInfo: device,
		}
	},

	openSurface: async (
		surfaceId: string,
		pluginInfo: HIDDevice,
		context: SurfaceContext,
	): Promise<OpenSurfaceResult> => {
		const contourShuttle = await setupShuttle(pluginInfo.path)
		try {
			logger.debug(`Opening ${pluginInfo.manufacturer} ${pluginInfo.product} (${surfaceId})`)

			let info: ShuttleModelInfo
			switch (contourShuttle.info.productModelId) {
				case ProductModelId.ShuttleXpress:
					info = contourShuttleXpressInfo
					break
				case ProductModelId.ShuttleProV1:
				case ProductModelId.ShuttleProV1a:
					info = contourShuttleProV1Info
					break
				case ProductModelId.ShuttleProV2:
					info = contourShuttleProV2Info
					break
				default:
					assertNever(contourShuttle.info.productModelId)
					throw new Error(`Unknown Contour Shuttle device detected: ${contourShuttle.info.name}`)
			}

			return {
				surface: new ContourShuttleWrapper(surfaceId, contourShuttle, info, context),
				registerProps: {
					brightness: false,
					surfaceLayout: createSurfaceSchema(info),
					pincodeMap: null,
					configFields: null,
					transferVariables: [
						{
							id: 'jogValueVariable',
							type: 'input',
							name: 'Variable to store Jog value to',
							description: 'This will pulse with -1 or 1 before returning to 0 when rotated.',
						},
						{
							id: 'shuttleValueVariable',
							type: 'input',
							name: 'Variable to store Shuttle value to',
							description:
								'This produces a value between -7 and 7. You can use an expression to convert it into a different range.',
						},
					],
					location: null,
				},
			}
		} catch (e) {
			await contourShuttle.close()
			throw e
		}
	},
}
export default ContourShuttlePlugin
