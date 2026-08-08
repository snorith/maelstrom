import { ATTRIBUTES, normalizeBlank } from "./character-data.mjs";

const { fields } = foundry.data;

export class WeaponData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			as: new fields.NumberField({ required: true, nullable: true, initial: null }),
			ds: new fields.NumberField({ required: true, nullable: true, initial: null }),
			damage: new fields.StringField({ initial: "" }),
			range: new fields.StringField({ initial: "" }),
			attributes: new fields.SchemaField({
				attack: new fields.StringField({ initial: "attack", choices: ATTRIBUTES }),
				defence: new fields.StringField({ initial: "defence", choices: ATTRIBUTES })
			}),
			price: new fields.StringField({ initial: "0" }),
			carriable: new fields.BooleanField({ initial: true }),
			notes: new fields.HTMLField({ initial: "" })
		};
	}

	/**
	 * Presence-guarded (runs on update deltas too — an absent key must never be
	 * assigned, or a partial update like {"system.damage": "1d6"} would also
	 * null out as/ds or reset the attribute selections).
	 */
	static migrateData(source) {
		normalizeBlank(source, "as");
		normalizeBlank(source, "ds");
		if (source.attributes) {
			if ("attack" in source.attributes && !source.attributes.attack) source.attributes.attack = "attack";
			if ("defence" in source.attributes && !source.attributes.defence) source.attributes.defence = "defence";
		}
		// Legacy `order`/`lastOrder` are handled by the one-time world migration
		// (module/migrations.mjs) because core `sort` is a document-level field;
		// the schema simply strips them from system data.
		return super.migrateData(source);
	}
}
