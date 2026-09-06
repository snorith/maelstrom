import { ATTRIBUTES } from "../data/character-data.mjs";
import { SYSTEM_ID } from "../constants.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

class MaelstromItemSheetBase extends HandlebarsApplicationMixin(ItemSheetV2) {
	static DEFAULT_OPTIONS = {
		classes: ["maelstrom", "sheet", "item"],
		position: { width: 550, height: 620 },
		window: { resizable: true },
		form: { submitOnChange: true, closeOnSubmit: false }
	};

	static TABS = {
		primary: {
			tabs: [
				{ id: "attributes", label: "MAELSTROM.item.tabs.attributes" },
				{ id: "description", label: "MAELSTROM.item.tabs.description" }
			],
			initial: "attributes"
		}
	};

	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		const item = this.item;

		context.item = item;
		context.system = item.system;
		context.fields = item.system.schema.fields;
		context.editable = this.isEditable;
		context.notEditable = !this.isEditable;
		context.tabs = this._prepareTabs("primary");

		context.enrichedNotes = await foundry.applications.ux.TextEditor.enrichHTML(
			item.system.notes,
			{ relativeTo: item, secrets: item.isOwner }
		);

		return context;
	}

	async _preparePartContext(partId, context, options) {
		context = await super._preparePartContext(partId, context, options);
		if (partId in (context.tabs ?? {})) context.tab = context.tabs[partId];
		return context;
	}
}

export class MaelstromAbilitySheet extends MaelstromItemSheetBase {
	static PARTS = {
		header: { template: `systems/${SYSTEM_ID}/templates/item/item-header.hbs` },
		tabs: { template: "templates/generic/tab-navigation.hbs" },
		attributes: { template: `systems/${SYSTEM_ID}/templates/item/ability-attributes.hbs`, scrollable: [""] },
		description: { template: `systems/${SYSTEM_ID}/templates/item/item-description.hbs`, scrollable: [""] }
	};
}

export class MaelstromWeaponSheet extends MaelstromItemSheetBase {
	static PARTS = {
		header: { template: `systems/${SYSTEM_ID}/templates/item/item-header.hbs` },
		tabs: { template: "templates/generic/tab-navigation.hbs" },
		attributes: { template: `systems/${SYSTEM_ID}/templates/item/weapon-attributes.hbs`, scrollable: [""] },
		description: { template: `systems/${SYSTEM_ID}/templates/item/item-description.hbs`, scrollable: [""] }
	};

	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		// Localized choices for the attack/defence attribute selects
		context.attributeChoices = Object.fromEntries(
			ATTRIBUTES.map((key) => [key, game.i18n.localize(`MAELSTROM.attribute.name.${key}`)])
		);
		return context;
	}
}
