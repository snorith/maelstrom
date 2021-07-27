import {referenceToGame, systemBasePath} from "../settings"

interface dialogCancelledT {
	discriminator: "cancelled"
}

interface modifierDialogFieldsT {
	discriminator: "fields",
	modifier: number
}

type modifierDialogT = dialogCancelledT | modifierDialogFieldsT

export async function getRollModifiers(baseModifier = 0): Promise<modifierDialogT> {
	const template = `${systemBasePath}/templates/dialog/modifiers.html`
	const html = await renderTemplate(template, {
		baseModifier
	})

	return new Promise(resolve => {
		const data = {
			title: game.i18n.localize("MAELSTROM.roll.dialog.title"),
			content: html,
			buttons: {
				cancel: {
					label: game.i18n.localize("MAELSTROM.roll.button.cancel"),
					callback: html => resolve({ discriminator: "cancelled" })
				},
				normal: {
					label: game.i18n.localize("MAELSTROM.roll.button.continue"),
					callback: html => resolve(_processRollDialog(html[0].querySelector("form")))
				}
			},
			default: "normal",
			close: () => resolve({ discriminator: "cancelled" })
		}
		new Dialog(data, undefined).render(true)
	})
}

function _processRollDialog(form: HTMLFormElement): modifierDialogFieldsT {
	const elements = form.elements
	let modifier = parseInt((elements.namedItem('modifier') as HTMLInputElement).value)
	modifier = isNaN(modifier) ? 0 : modifier

	return {
		discriminator: "fields",
		modifier
	}
}
