import { ATTRIBUTES, normalizeBlank } from "./character-data.mjs";

const { fields } = foundry.data;

export class WeaponData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			// Retain until world migration reads it: v14 prunes unknown source keys.
			// Null distinguishes newly-created weapons from legacy order zero.
			order: new fields.NumberField({ required: true, nullable: true, initial: null }),
			as: new fields.NumberField({ required: true, nullable: true, initial: null }),
			ds: new fields.NumberField({ required: true, nullable: true, initial: null }),
			damage: new fields.StringField({ initial: "" }),
			range: new fields.StringField({ initial: "" }),
			// No `choices:` here — choices INVALIDATE nonconforming legacy documents
			// instead of normalizing them; migrateData below maps out-of-list values
			// to the defaults instead.
			attributes: new fields.SchemaField({
				attack: new fields.StringField({ initial: "attack" }),
				defence: new fields.StringField({ initial: "defence" })
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
		normalizeBlank(source, "order");
		if ("order" in source && source.order !== null) {
			const order = Number(source.order);
			source.order = Number.isFinite(order) && order >= 0 ? order : null;
		}
		// Normalize ONLY present keys; anything not a known attribute id (blank,
		// non-string, hand-edited garbage) becomes the field default.
		if (source.attributes && typeof source.attributes === "object") {
			if ("attack" in source.attributes && !ATTRIBUTES.includes(source.attributes.attack)) {
				source.attributes.attack = "attack";
			}
			if ("defence" in source.attributes && !ATTRIBUTES.includes(source.attributes.defence)) {
				source.attributes.defence = "defence";
			}
		}
		// Legacy order is retained for world migration; lastOrder is unused.
		return super.migrateData(source);
	}
}
