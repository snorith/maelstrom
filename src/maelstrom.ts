/**
 * Maelstrom Domesday / Gothic / Rome RPG system
 *
 * Author: Stephen Smith
 * Content License:
 *		The Maelstrom RPG is © Alexander Scott all rights reserved.
 *		The Maelstrom RPG is a trademark of Alexander Scott and is used under license.
 *		This edition is printed and distributed, under license, by Arion Games
 *		For further information about other Arion Games products check  out  our  website  and  forums  at http://www.arion-games.com
 *		Content on this site or associated files derived from Arion Games publications is used under agreement with the license holder and should not be construed as a challenge to those trademarks or copyrights.
 *		The contents of this site are for personal, non-commercial use only. Arion Games is not responsible for this site or any of the content.
 * Software License: The MIT License (MIT)
 */

// Import TypeScript modules
import {registerSettings, systemName} from './module/settings.js';
import { preloadTemplates } from './module/preloadTemplates.js';
import { MaelstromActor } from  './module/actor/actor'
import { MaelstromActorSheet } from "./module/actor/actorsheet"
import { MaelstromAbilityItemSheet } from "./module/item/sheets/MaelstromAbilityItemSheet"
import { MaelstromItem } from "./module/item/MaelstromItem"

/* ------------------------------------ */
/* Initialize system					*/
/* ------------------------------------ */
Hooks.once('init', async function() {
	console.log('Maelstrom | Initializing Maelstrom system');

	// Assign custom classes and constants here
	game.maelstrom = {
		MaelstromActor,

	}

	// define custom entity classes
	CONFIG.Actor.entityClass = MaelstromActor
	// @ts-ignore
	CONFIG.Item.entityClass = MaelstromItem

	Actors.unregisterSheet("core", ActorSheet)
	Actors.registerSheet(systemName, MaelstromActorSheet, { makeDefault: true })

	Items.unregisterSheet("core", ItemSheet);
	Items.registerSheet(systemName, MaelstromAbilityItemSheet, { types: ["ability"], makeDefault: true });

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

// Add any additional hooks if necessary


