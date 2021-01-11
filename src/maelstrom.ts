/**
 * Maelstrom Domesday / Gothic / Rome RPG system
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

// Import TypeScript modules
import {registerSettings, systemName} from './module/settings.js';
import { preloadTemplates } from './module/preloadTemplates.js';
import { MaelstromActor } from  './module/actor/MaelstromActor'
import { MaelstromActorSheet } from "./module/actor/MaelstromActorSheet"
import { MaelstromAbilityItemSheet } from "./module/item/sheets/MaelstromAbilityItemSheet"
import { MaelstromItem } from "./module/item/MaelstromItem"
import {migrateWorld} from "./module/migrations/migrate"
import {MAELSTROM} from "./module/config"
import {MaelstromAbilityItem} from "./module/item/MaelstromAbilityItem"
import {MaelstromWeaponItem} from "./module/item/MaelstromWeaponItem"
import {MaelstromWeaponItemSheet} from "./module/item/sheets/MaelstromWeaponItemSheet"
import {MaelstromItemSheet} from "./module/item/sheets/MaelstromItemSheet"

/* ------------------------------------ */
/* Initialize system					*/
/* ------------------------------------ */
Hooks.once('init', async function() {
	console.log('Maelstrom | Initializing Maelstrom system');

	// Assign custom classes and constants here
	game.maelstrom = {
		MaelstromActor,
		MaelstromActorSheet,
		MaelstromAbilityItem,
		MaelstromAbilityItemSheet,
		MaelstromWeaponItem,
		MaelstromWeaponItemSheet
	}

	game.MAELSTROM = MAELSTROM

	/**
	 * Set an initiative formula for the system
	 * @type {String}
	 */
	CONFIG.Combat.initiative = {
		formula: "2d10 + @attributes.speed.current + @initiative.modifier + (@attributes.speed.current / 100)",
		decimals: 2,
	};

	// define custom entity classes
	CONFIG.Actor.entityClass = MaelstromActor
	// @ts-ignore
	CONFIG.Item.entityClass = MaelstromItem

	Actors.unregisterSheet("core", ActorSheet)
	Actors.registerSheet(systemName, MaelstromActorSheet, { makeDefault: true })

	Items.unregisterSheet("core", ItemSheet);
	Items.registerSheet(systemName, MaelstromAbilityItemSheet, { types: [MaelstromAbilityItem.type], makeDefault: true, label: "Maelstrom Ability Item" });
	Items.registerSheet(systemName, MaelstromWeaponItemSheet, { types: [MaelstromWeaponItem.type], makeDefault: true, label: "Maelstrom Weapon Item" });

	// Register custom system settings
	registerSettings();
	
	// Preload Handlebars templates
	await preloadTemplates();

	// Register custom sheets (if any)
});

/* ------------------------------------ */
/* Setup system							*/
/* ------------------------------------ */
Hooks.once('setup', function() {
	// Do anything after initialization but before
	// ready
});

/* ------------------------------------ */
/* When ready							*/
/* ------------------------------------ */
Hooks.once('ready', function() {
	// Do anything once the system is ready
});

Hooks.once("ready", migrateWorld);

// Add any additional hooks if necessary


