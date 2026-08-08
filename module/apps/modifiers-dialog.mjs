/**
 * Prompt for a situational roll modifier (SPEC §5).
 *
 * @param {number} baseModifier - initial value shown in the input
 * @returns {Promise<{cancelled: true}|{cancelled: false, modifier: number}>}
 */
export async function getRollModifiers(baseModifier = 0) {
	const label = foundry.utils.escapeHTML(game.i18n.localize("MAELSTROM.roll.modifier.label"));
	const title = foundry.utils.escapeHTML(game.i18n.localize("MAELSTROM.roll.modifier.title"));

	const content = `
		<div class="form-group">
			<label for="maelstrom-roll-modifier">${label}</label>
			<input type="number" name="modifier" id="maelstrom-roll-modifier"
				value="${Number.isFinite(baseModifier) ? baseModifier : 0}"
				data-tooltip="${title}" autofocus>
		</div>`;

	const result = await foundry.applications.api.DialogV2.wait({
		window: { title: game.i18n.localize("MAELSTROM.roll.dialog.title") },
		content,
		rejectClose: false, // dismissing the window = cancel
		render: (event, dialog) => {
			// select-on-focus (SPEC §5): typing immediately replaces the default 0
			const element = dialog?.element ?? dialog;
			element?.querySelector?.('input[name="modifier"]')?.select();
		},
		buttons: [
			{
				action: "roll",
				label: game.i18n.localize("MAELSTROM.roll.button.continue"),
				default: true,
				callback: (event, button) => {
					const value = Number.parseInt(button.form.elements.modifier?.value, 10);
					return Number.isFinite(value) ? value : 0;
				}
			},
			{
				action: "cancel",
				label: game.i18n.localize("MAELSTROM.roll.button.cancel")
			}
		]
	});

	if (result === null || result === "cancel") return { cancelled: true };
	return { cancelled: false, modifier: result };
}
