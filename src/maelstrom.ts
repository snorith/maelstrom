/**
 * This is your TypeScript entry file for Foundry VTT.
 * Register custom settings, sheets, and constants using the Foundry API.
 * Change this heading to be more descriptive to your system, or remove it.
 * Author: Stephen Smith
 * Content License: [copyright and-or license] If using an existing system
 * 					you may want to put a (link to a) license or copyright
 * 					notice here (e.g. the OGL).
 * Software License: [your license] Put your desired license here, which
 * 					 determines how others may use and modify your system
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


