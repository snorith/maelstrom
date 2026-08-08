import { ATTRIBUTES } from "./character-data.mjs";

const { fields } = foundry.data;

/** Convert a legacy `""` value to null so NumberField doesn't cast it to 0. */
function blankToNull(value) {
	if (value === "" || value === undefined) return null;
	return value;
}

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

	static migrateData(source) {
		source.as = blankToNull(source.as);
		source.ds = blankToNull(source.ds);
		if (source.attributes) {
			if (!source.attributes.attack) source.attributes.attack = "attack";
			if (!source.attributes.defence) source.attributes.defence = "defence";
		}
		// Legacy `order`/`lastOrder` are handled by the one-time world migration
		// (module/migrations.mjs) because core `sort` is a document-level field;
		// the schema simply strips them from system data.
		return super.migrateData(source);
	}
}
