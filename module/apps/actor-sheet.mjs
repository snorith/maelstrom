import { ATTRIBUTES } from "../data/character-data.mjs";
import { SYSTEM_ID } from "../constants.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { escapeHTML } = foundry.utils;

/** Render a number as its value, or blank for 0/null (legacy zero-blank display). */
function zeroBlank(value) {
	return Number.isFinite(value) && value !== 0 ? value : "";
}

export class MaelstromCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
	static DEFAULT_OPTIONS = {
		classes: ["maelstrom", "sheet", "actor"],
		position: { width: 925, height: 1000 },
		window: { resizable: true },
		form: { submitOnChange: true, closeOnSubmit: false },
		actions: {
			rollAttribute: MaelstromCharacterSheet.onRollAttribute,
			rollWeapon: MaelstromCharacterSheet.onRollWeapon,
			rollDamage: MaelstromCharacterSheet.onRollDamage,
			rollInitiative: MaelstromCharacterSheet.onRollInitiative,
			healWounds: MaelstromCharacterSheet.onHealWounds,
			bleedingDamage: MaelstromCharacterSheet.onBleedingDamage,
			createItem: MaelstromCharacterSheet.onCreateItem,
			editItem: MaelstromCharacterSheet.onEditItem,
			deleteItem: MaelstromCharacterSheet.onDeleteItem
		}
	};

	static PARTS = {
		header: { template: `systems/${SYSTEM_ID}/templates/actor/header.hbs` },
		tabs: { template: "templates/generic/tab-navigation.hbs" },
		// scrollable [""] = the part's root element scrolls (sanctioned idiom)
		attributes: { template: `systems/${SYSTEM_ID}/templates/actor/attributes.hbs`, scrollable: [""] },
		equipment: { template: `systems/${SYSTEM_ID}/templates/actor/equipment.hbs`, scrollable: [""] },
		description: { template: `systems/${SYSTEM_ID}/templates/actor/description.hbs`, scrollable: [""] }
	};

	static TABS = {
		primary: {
			tabs: [
				{ id: "attributes", label: "MAELSTROM.sheet.tabs.attributes" },
				{ id: "equipment", label: "MAELSTROM.sheet.tabs.equip" },
				{ id: "description", label: "MAELSTROM.sheet.tabs.description" }
			],
			initial: "attributes"
		}
	};

	/* -------------------------------------------- */
	/* Context                                       */
	/* -------------------------------------------- */

	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		const actor = this.actor;
		const system = actor.system;

		context.actor = actor;
		context.system = system;
		context.fields = system.schema.fields;
		context.editable = this.isEditable;
		context.notEditable = !this.isEditable;
		context.tabs = this._prepareTabs("primary");

		// Game flavour (1 Domesday / 2 Gothic / 3 Rome): Gothic relabels Favour → Renown
		const flavour = game.settings.get(SYSTEM_ID, "characterSheet");
		context.favourLabel = game.i18n.localize(
			flavour === 2 ? "MAELSTROM.character.renown.label" : "MAELSTROM.character.favour.label"
		);

		context.attributeRows = ATTRIBUTES.map((key) => ({
			key,
			baseName: `system.attributes.${key}`,
			orig: system.attributes[key].orig,
			temp: system.attributes[key].temp,
			used: system.attributes[key].used,
			nameLabel: game.i18n.localize(`MAELSTROM.attribute.name.${key}`),
			detailLabel: game.i18n.localize(`MAELSTROM.attribute.detail.${key}`),
			rollLabel: game.i18n.localize(`MAELSTROM.attribute.roll.${key}`)
		}));

		this.#prepareWounds(context, system);
		this.#prepareItems(context, actor);

		context.careers = ["c1", "c2", "c3", "c4", "c5", "c6"].map((key) => ({
			baseName: `system.events.careers.${key}`,
			...system.events.careers[key]
		}));

		context.armourDisplay = {
			ar: zeroBlank(system.armour.ar),
			penalty: zeroBlank(system.armour.penalty)
		};

		context.enrichedBiography = await foundry.applications.ux.TextEditor.enrichHTML(
			system.biography,
			{ relativeTo: actor, rollData: actor.getRollData(), secrets: actor.isOwner }
		);

		return context;
	}

	/** Attach each tab part's tab descriptor as context.tab. */
	async _preparePartContext(partId, context, options) {
		context = await super._preparePartContext(partId, context, options);
		if (partId in (context.tabs ?? {})) context.tab = context.tabs[partId];
		return context;
	}

	#prepareWounds(context, system) {
		const wounds = system.wounds.wounds;
		const last = wounds.length - 1;

		// Slots 0..9 are ordinary wounds; the last slot is bloodloss damage
		context.normalWounds = wounds.slice(0, last).map((value, index) => ({
			name: `system.wounds.wounds.${index}`,
			value: zeroBlank(value),
			tooltip: game.i18n.format("MAELSTROM.wounds.wounds.index", { index })
		}));
		context.bloodlossSlot = {
			name: `system.wounds.wounds.${last}`,
			value: zeroBlank(wounds[last])
		};
		context.bloodlossDisplay = zeroBlank(system.wounds.bloodloss);
		// > 0 (not ≠ 0) to match the action's own guard; also gated on editability
		// so observers see disabled icons instead of no-op controls
		context.canBleed =
			this.isEditable && Number.isFinite(system.wounds.bloodloss) && system.wounds.bloodloss > 0;
		context.canHeal = this.isEditable && system.hp.wounds > 0;
		context.isUnconscious = system.isUnconscious;
		context.isDead = system.isDead;
	}

	#prepareItems(context, actor) {
		const abilities = actor.items
			.filter((i) => i.type === "ability")
			.sort((a, b) => a.name.localeCompare(b.name));
		const weapons = actor.items
			.filter((i) => i.type === "weapon")
			.sort((a, b) => a.sort - b.sort);

		context.abilities = abilities.map((item) => ({
			id: item.id,
			name: item.name,
			img: item.img,
			rank: item.system.rank,
			benefit: item.system.benefit,
			hasNotes: !!item.system.notes?.trim(),
			tooltip: this.#itemTooltip(item, [
				["MAELSTROM.abilities.column.rank.title", item.system.rank],
				["MAELSTROM.abilities.column.benefit.title", item.system.benefit]
			])
		}));

		context.weapons = weapons.map((item) => ({
			id: item.id,
			name: item.name,
			img: item.img,
			as: zeroBlank(item.system.as),
			ds: zeroBlank(item.system.ds),
			damage: item.system.damage,
			range: item.system.range,
			attackAttribute: item.system.attributes.attack,
			defenceAttribute: item.system.attributes.defence,
			canRollDamage: !!item.system.damage?.trim(),
			hasNotes: !!item.system.notes?.trim(),
			tooltip: this.#itemTooltip(item, [
				["MAELSTROM.weapons.column.as.title", item.system.as],
				["MAELSTROM.weapons.column.ds.title", item.system.ds],
				["MAELSTROM.weapons.column.damage.title", item.system.damage],
				["MAELSTROM.weapons.column.range.title", item.system.range]
			])
		}));
	}

	/** Rich hover card (replaces tooltipster): header + field table + raw notes HTML. */
	#itemTooltip(item, rows) {
		const rowsHtml = rows
			.map(
				([labelKey, value]) =>
					`<tr><td>${escapeHTML(game.i18n.localize(labelKey))}</td><td>${escapeHTML(String(value ?? ""))}</td></tr>`
			)
			.join("");
		const notes = item.system.notes?.trim() ? `<hr>${item.system.notes}` : "";
		return `<div class="maelstrom-item-tooltip">
			<img src="${escapeHTML(item.img)}" alt="${escapeHTML(item.name)}" height="50">
			<h1>${escapeHTML(item.name)}</h1>
			<table><tbody>${rowsHtml}</tbody></table>
			${notes}
		</div>`;
	}

	/* -------------------------------------------- */
	/* Actions                                       */
	/* -------------------------------------------- */

	// Roll actions are owner-gated like everything else: the legacy sheet
	// attached NO listeners for non-editable viewers, and rolls post to chat
	// speaking AS the character — observers must not roll on its behalf.
	// (Review round 3, devin — overturns the round-2 assumption.)

	/** @this {MaelstromCharacterSheet} */
	static onRollAttribute(event, target) {
		if (!this.isEditable) return;
		return this.actor.rollAttribute(target.dataset.attribute);
	}

	/** @this {MaelstromCharacterSheet} */
	static onRollWeapon(event, target) {
		if (!this.isEditable) return;
		const modifier = Number(target.dataset.modifier);
		return this.actor.rollAttribute(target.dataset.attribute, {
			modifiers: Number.isFinite(modifier) ? [modifier] : [],
			itemName: target.dataset.name
		});
	}

	/** @this {MaelstromCharacterSheet} */
	static onRollDamage(event, target) {
		if (!this.isEditable) return;
		return this.actor.rollItemDamage(target.dataset.name, target.dataset.damage);
	}

	/** @this {MaelstromCharacterSheet} */
	static onRollInitiative() {
		if (!this.isEditable) return;
		return this.actor.rollActorInitiative();
	}

	/** @this {MaelstromCharacterSheet} */
	static onHealWounds() {
		if (!this.isEditable) return;
		return this.actor.healAllWoundsByOne();
	}

	/** @this {MaelstromCharacterSheet} */
	static onBleedingDamage() {
		if (!this.isEditable) return;
		return this.actor.sufferBleedingDamage();
	}

	/** @this {MaelstromCharacterSheet} */
	static async onCreateItem(event, target) {
		if (!this.isEditable) return;
		const type = target.dataset.type;
		const capitalized = type.charAt(0).toUpperCase() + type.slice(1);
		const name = game.i18n.localize(`MAELSTROM.item.${type}.new${capitalized}`);
		return this.actor.createEmbeddedDocuments("Item", [{ name, type }]);
	}

	/** @this {MaelstromCharacterSheet} */
	static onEditItem(event, target) {
		const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
		item?.sheet.render(true);
	}

	/** @this {MaelstromCharacterSheet} */
	static async onDeleteItem(event, target) {
		if (!this.isEditable) return;
		const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
		if (!item) return;
		const confirmed = await foundry.applications.api.DialogV2.confirm({
			window: { title: game.i18n.localize("MAELSTROM.item.delete.title") },
			content: `<p>${game.i18n.format("MAELSTROM.item.delete.content", {
				name: foundry.utils.escapeHTML(item.name)
			})}</p>`
		});
		if (confirmed) await item.delete();
	}
}
