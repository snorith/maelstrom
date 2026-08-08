import { PHYSICAL_ATTRIBUTES } from "../data/character-data.mjs";
import { rollOutcome, stackModifiers, formatBreakdown } from "../rolls.mjs";
import { getRollModifiers } from "../apps/modifiers-dialog.mjs";
import { INITIATIVE_FORMULA } from "../maelstrom.mjs";

const { escapeHTML } = foundry.utils;

export class MaelstromActor extends Actor {
	/**
	 * Roll a 1d100 saving throw against an attribute (SPEC §1.3).
	 *
	 * @param {string} attributeName - key into system.attributes
	 * @param {object} [options]
	 * @param {number[]} [options.modifiers] - extra modifiers (e.g. weapon AS/DS)
	 * @param {string} [options.itemName] - names the roll after an item (weapon)
	 */
	async rollAttribute(attributeName, { modifiers = [], itemName = "" } = {}) {
		if (this.type !== "character") return;
		const attribute = this.system.attributes[attributeName];
		if (!attribute) {
			console.error(`Maelstrom | Unknown attribute "${attributeName}"`);
			return;
		}

		const stack = [...modifiers];

		// Armour penalty applies to physical attribute rolls only
		if (PHYSICAL_ATTRIBUTES.includes(attributeName)) {
			const penalty = this.system.armour.penalty;
			if (Number.isFinite(penalty) && penalty !== 0) stack.unshift(penalty);
		}

		const dialog = await getRollModifiers(0);
		if (dialog.cancelled) return;
		stack.push(dialog.modifier);

		const stacked = stackModifiers([attribute.current, ...stack]);

		const roll = await new Roll("1d100").evaluate();
		const outcome = rollOutcome(roll.total, stacked.total);

		let title = game.i18n.localize(`MAELSTROM.attribute.detail.${attributeName}`);
		title = itemName?.trim()
			? game.i18n.format("MAELSTROM.roll.outcome.attribute.with.item", {
					attribute: title,
					item: itemName.trim()
				})
			: game.i18n.format("MAELSTROM.roll.outcome.attribute.without.item", { attribute: title });

		const breakdown = game.i18n.format("MAELSTROM.roll.outcome.attribute.value.modified", {
			value: formatBreakdown(stacked)
		});
		const outcomeText = game.i18n.localize(`MAELSTROM.roll.outcome.${outcome}`);

		const flavor = `<h3>${escapeHTML(title)}</h3>
			${escapeHTML(breakdown)}
			<h3 class="maelstrom-roll-outcome maelstrom-roll-outcome-${outcome}">${escapeHTML(outcomeText)}</h3>`;

		await roll.toMessage(
			{
				speaker: ChatMessage.getSpeaker({ actor: this }),
				flavor
			},
			{ rollMode: CONST.DICE_ROLL_MODES.PUBLIC }
		);
	}

	/**
	 * Roll a weapon's damage formula (SPEC §1.4). Invalid formulas produce a chat
	 * error card instead of throwing.
	 */
	async rollItemDamage(name, damage = "") {
		name = name?.trim() ?? "";
		damage = damage?.trim() ?? "";

		const title = game.i18n.format("MAELSTROM.roll.item.with.damage", { item: name });
		const flavor = `<h3>${escapeHTML(title)}</h3>`;

		try {
			const roll = await new Roll(damage).evaluate();
			await roll.toMessage(
				{
					speaker: ChatMessage.getSpeaker({ actor: this }),
					flavor
				},
				{ rollMode: CONST.DICE_ROLL_MODES.PUBLIC }
			);
		} catch (err) {
			const errorMsg = game.i18n.format("MAELSTROM.roll.item.damage.invalid", { formula: damage });
			await ChatMessage.create({
				user: game.user?.id,
				speaker: ChatMessage.getSpeaker({ actor: this }),
				content: `${flavor}<span class="maelstrom-roll-error">${escapeHTML(errorMsg)}</span>`
			});
		}
	}

	/** Standalone initiative roll from the sheet (SPEC §1.5). */
	async rollActorInitiative() {
		try {
			const roll = await new Roll(INITIATIVE_FORMULA, this.getRollData()).evaluate();
			await roll.toMessage(
				{
					speaker: ChatMessage.getSpeaker({ actor: this }),
					flavor: escapeHTML(game.i18n.localize("MAELSTROM.initiative.roll.message.flavour"))
				},
				{ rollMode: CONST.DICE_ROLL_MODES.PUBLIC }
			);
		} catch (err) {
			console.error("Maelstrom | Initiative roll failed", err);
		}
	}

	/**
	 * Heal every open wound by 1 (SPEC §1.6). Unlike the legacy sheet this
	 * persists via update instead of mutating in-memory data.
	 */
	async healAllWoundsByOne() {
		const wounds = this.system.wounds.wounds;
		const healed = wounds.map((v) => (Number.isFinite(v) && v > 0 ? v - 1 : 0));
		await this.update({ "system.wounds.wounds": healed });
	}

	/**
	 * Suffer one round of bleeding: add the bleeding-wound count to the bloodloss
	 * damage slot (last slot) (SPEC §1.6). Persists via update.
	 */
	async sufferBleedingDamage() {
		const bleeding = this.system.wounds.bloodloss;
		if (!Number.isFinite(bleeding) || bleeding <= 0) return;

		const wounds = [...this.system.wounds.wounds];
		if (wounds.length < 1) return;
		const last = wounds.length - 1;
		wounds[last] = (Number.isFinite(wounds[last]) ? wounds[last] : 0) + bleeding;
		await this.update({ "system.wounds.wounds": wounds });
	}
}
