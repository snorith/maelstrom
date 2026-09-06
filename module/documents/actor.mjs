import { PHYSICAL_ATTRIBUTES } from "../data/character-data.mjs";
import { rollOutcome, stackModifiers, formatBreakdown } from "../rolls.mjs";
import { getRollModifiers } from "../apps/modifiers-dialog.mjs";
import { INITIATIVE_FORMULA } from "../constants.mjs";

const { escapeHTML } = foundry.utils;

function mergeIndexedWounds(data, current) {
	if (!Array.isArray(current)) return data;
	// Detect every nested/dotted spelling without cloning unrelated updates.
	const hasPath = (object, prefix = "") => object && typeof object === "object" && !Array.isArray(object)
		&& Object.entries(object).some(([key, value]) => {
			const path = prefix ? `${prefix}.${key}` : key;
			return path === "system.wounds.wounds" || path.startsWith("system.wounds.wounds.")
				|| ("system.wounds.wounds".startsWith(`${path}.`) && hasPath(value, path));
		});
	if (!hasPath(data)) return data;
	data = foundry.utils.expandObject(foundry.utils.deepClone(data));
	const partial = data.system?.wounds?.wounds;
	if (partial && Object.getPrototypeOf(partial) === Object.prototype) {
		const merged = [...current];
		for (const [key, value] of Object.entries(partial)) {
			if (/^(?:[0-9]|10)$/.test(key)) merged[Number(key)] = value;
		}
		data.system.wounds.wounds = merged;
	}
	return data;
}

export class MaelstromActor extends Actor {
	/** v13 migrates update data even before cleaning; preserve raw instance edits. */
	async update(data = {}, operation = {}) {
		return super.update(mergeIndexedWounds(data, this._source?.system?.wounds?.wounds), operation);
	}

	/** Merge indexed wound edits before v14 invokes the system migration. */
	static cleanData(data = {}, options = {}, state = {}) {
		const source = state.source ?? state.model?._source ?? options.source;
		const current = source?.system?.wounds?.wounds;
		if (options.partial) data = mergeIndexedWounds(data, current);
		return super.cleanData(data, options, state);
	}

	/**
	 * Foundry ArrayField deltas REPLACE the stored array, so a partial update
	 * like `actor.update({"system.wounds.wounds.3": 5})` from a macro would
	 * zero-fill the other slots. Merge partial wound objects onto the current
	 * array before the replacement happens. Full-form submits (all 11 keys)
	 * and full-array writes pass through unchanged.
	 * Compatibility fallback for cores which still pass objects here. On v14
	 * cleaning precedes this hook; cleanData above handles that path instead.
	 */
	async _preUpdate(changes, options, user) {
		if (Array.from(this.items ?? []).some((item) => item.getFlag?.("maelstrom", "woundJournal"))
			&& (changes.system?.wounds?.wounds !== undefined || changes.system?.wounds?.bloodloss !== undefined)) {
			throw new Error("Journal-backed wounds must be changed through actor.applyWoundOperation().");
		}
		const partial = changes?.system?.wounds?.wounds;
		if (partial && typeof partial === "object" && !Array.isArray(partial)) {
			const current = this.system?.wounds?.wounds ?? [];
			const merged = [...current];
			for (const [key, value] of Object.entries(partial)) {
				const idx = Number(key);
				if (Number.isInteger(idx) && idx >= 0 && idx < merged.length) merged[idx] = value;
			}
			changes.system.wounds.wounds = merged;
		}
		return super._preUpdate(changes, options, user);
	}

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
		return this.applyWoundOperation({ type: "healAll" });
	}

	/**
	 * Suffer one round of bleeding: add the bleeding-wound count to the bloodloss
	 * damage slot (last slot) (SPEC §1.6). Persists via update.
	 */
	async sufferBleedingDamage() {
		return this.applyWoundOperation({ type: "applyBleeding" });
	}

	/** Public macro API. GM clients append immutable authoritative revisions. */
	async applyWoundOperation(operation) {
		return this.#queueWoundOperation(() => game.maelstrom.wounds.submit(this, operation));
	}

	// Preserve invocation order locally; the GM queue serializes all clients.
	#woundOperations = Promise.resolve();

	#queueWoundOperation(operation) {
		const result = this.#woundOperations.then(operation);
		this.#woundOperations = result.catch(() => {});
		return result;
	}
}
