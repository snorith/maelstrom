/**
 * Maelstrom Domesday / Gothic / Rome RPG system for Foundry VTT v13+
 *
 * Author: Stephen Smith
 * Content License:
 *		The Maelstrom RPG is © Alexander Scott all rights reserved.
 *		The Maelstrom RPG is a trademark of Alexander Scott and is used under license.
 *		This edition is printed and distributed, under license, by Arion Games
 *		For further information about other Arion Games products check out their website and forums at http://www.arion-games.com
 *		Content on this site or associated files derived from Arion Games publications is used as fan material and should not be construed as a challenge to those trademarks or copyrights.
 *		The contents of this site are for personal, non-commercial use only. Arion Games is not responsible for this site or any of the content.
 * Software License: The MIT License (MIT)
 */

import { CharacterData } from "./data/character-data.mjs";
import { AbilityData } from "./data/ability-data.mjs";
import { WeaponData } from "./data/weapon-data.mjs";
import { EquipmentData } from "./data/equipment-data.mjs";
import { registerMigrationSetting, migrateWorld } from "./migrations.mjs";
import { MaelstromActor } from "./documents/actor.mjs";
import { MaelstromItem } from "./documents/item.mjs";
import { MaelstromCharacterSheet } from "./apps/actor-sheet.mjs";
import { MaelstromAbilitySheet, MaelstromWeaponSheet } from "./apps/item-sheets.mjs";

export { SYSTEM_ID, INITIATIVE_FORMULA } from "./constants.mjs";
import { SYSTEM_ID, INITIATIVE_FORMULA } from "./constants.mjs";

/* ------------------------------------ */
/* Initialize system                    */
/* ------------------------------------ */
Hooks.once("init", () => {
	console.log("Maelstrom | Initializing Maelstrom system");

	CONFIG.Combat.initiative = {
		formula: INITIATIVE_FORMULA,
		decimals: 2
	};

	CONFIG.Actor.dataModels.character = CharacterData;
	CONFIG.Item.dataModels.ability = AbilityData;
	CONFIG.Item.dataModels.weapon = WeaponData;
	CONFIG.Item.dataModels.equipment = EquipmentData;

	CONFIG.Actor.documentClass = MaelstromActor;
	CONFIG.Item.documentClass = MaelstromItem;

	registerMigrationSetting();
	registerSystemSettings();

	const { Actors, Items } = foundry.documents.collections;
	Actors.registerSheet(SYSTEM_ID, MaelstromCharacterSheet, {
		types: ["character"],
		makeDefault: true,
		label: "MAELSTROM.sheet.character.label"
	});
	Items.registerSheet(SYSTEM_ID, MaelstromAbilitySheet, {
		types: ["ability"],
		makeDefault: true,
		label: "MAELSTROM.item.ability.sheet.label"
	});
	Items.registerSheet(SYSTEM_ID, MaelstromWeaponSheet, {
		types: ["weapon"],
		makeDefault: true,
		label: "MAELSTROM.item.weapon.sheet.label"
	});
});

function registerSystemSettings() {
	game.settings.register(SYSTEM_ID, "characterSheet", {
		name: "MAELSTROM.settings.characterSheet.name",
		hint: "MAELSTROM.settings.characterSheet.hint",
		scope: "world",
		config: true,
		type: Number,
		default: 1,
		choices: {
			1: "MAELSTROM.settings.characterSheet.domesday",
			2: "MAELSTROM.settings.characterSheet.gothic",
			3: "MAELSTROM.settings.characterSheet.rome"
		}
	});

	game.settings.register(SYSTEM_ID, "trademarkNotice", {
		name: "Trademark Notice",
		hint:
			"The Maelstrom RPG is © Alexander Scott all rights reserved. \n" +
			"The Maelstrom RPG is a trademark of Alexander Scott and is used under license. \n\n" +
			"This edition is printed and distributed, under license, by Arion Games\n" +
			"For further information about other Arion Games products check out their website and forums at http://www.arion-games.com\n" +
			"Content on this site or associated files derived from Arion Games publications is used as fan material and should not be construed as a challenge to those trademarks or copyrights.\n" +
			"The contents of this site are for personal, non-commercial use only. Arion Games is not responsible for this site or any of the content.",
		scope: "world",
		config: true,
		type: String,
		default: ""
	});
}

/* ------------------------------------ */
/* Ready                                */
/* ------------------------------------ */
Hooks.once("ready", () => migrateWorld());
