const { fields } = foundry.data;

/**
 * Minimal data model for the legacy `equipment` item type. The v9 system
 * declared this type in template.json but never shipped a sheet or UI for it
 * (its sheet factory threw). It is kept as a declared type purely as a safety
 * net: a legacy world that somehow contains one (console/macro creation) must
 * keep loading instead of producing an invalid document. Not rendered on the
 * actor sheet; the core default item sheet applies if one is ever opened.
 * (Review round 3, devin finding — see z/PLAN.md ledger.)
 */
export class EquipmentData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			description: new fields.StringField({ initial: "" }),
			price: new fields.StringField({ initial: "0" }),
			carriable: new fields.BooleanField({ initial: true }),
			notes: new fields.HTMLField({ initial: "" })
		};
	}
}
