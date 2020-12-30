import {systemBasePath} from "./settings"

export const preloadTemplates = async function() {
	const templatePaths = [
		// Add paths to `${systemBasePath}/templates`

		// Actor Sheets
		`${systemBasePath}/templates/actor/actorSheet.html`,

		//Item sheets
		`${systemBasePath}/templates/item/abilitySheet.html`,
	];

	return loadTemplates(templatePaths);
}
