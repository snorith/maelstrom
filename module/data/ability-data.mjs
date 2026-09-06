const { fields } = foundry.data;

export class AbilityData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			rank: new fields.StringField({ initial: "" }),
			benefit: new fields.StringField({ initial: "" }),
			notes: new fields.HTMLField({ initial: "" })
		};
	}

	static migrateData(source) {
		// Legacy `order`, `lastOrder`, `version`, `price`, `carriable` keys are
		// stripped by the schema; nothing to coerce.
		return super.migrateData(source);
	}
}
