const { fields } = foundry.data;

/** The ten Maelstrom attributes, in sheet order. */
export const ATTRIBUTES = [
	"attack",
	"missile",
	"defence",
	"knowledge",
	"will",
	"endurance",
	"persuasion",
	"perception",
	"speed",
	"agility"
];

/** Attributes that suffer the armour penalty on rolls. */
export const PHYSICAL_ATTRIBUTES = ["attack", "missile", "defence", "speed", "agility"];

/** Number of wound slots; the last slot is bloodloss damage. */
export const WOUND_SLOTS = 11;

/**
 * One attribute: `orig` is the rolled value, `temp` (nullable) overrides it when
 * set, `used` is a bookkeeping checkbox with no mechanical effect. The effective
 * value is the derived, non-persisted `current`.
 */
function attributeField() {
	return new fields.SchemaField({
		orig: new fields.NumberField({ required: true, nullable: true, initial: 40 }),
		temp: new fields.NumberField({ required: true, nullable: true, initial: null }),
		used: new fields.BooleanField({ initial: false })
	});
}

function careerField() {
	return new fields.SchemaField({
		living: new fields.StringField({ initial: "" }),
		years: new fields.StringField({ initial: "" }),
		event: new fields.StringField({ initial: "" })
	});
}

/** Convert a legacy `""`/non-numeric value to null so NumberField doesn't cast it to 0. */
function blankToNull(value) {
	if (value === "" || value === undefined) return null;
	return value;
}

export class CharacterData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			biography: new fields.HTMLField({ initial: "" }),
			age: new fields.NumberField({ required: true, nullable: true, initial: 13 }),
			race: new fields.StringField({ initial: "" }),
			sex: new fields.StringField({ initial: "" }),
			social: new fields.StringField({ initial: "" }),
			imbalance: new fields.StringField({ initial: "" }),
			favour: new fields.StringField({ initial: "" }),
			patron: new fields.StringField({ initial: "" }),
			money: new fields.SchemaField({
				amount: new fields.StringField({ initial: "" })
			}),
			attributes: new fields.SchemaField(
				Object.fromEntries(ATTRIBUTES.map((key) => [key, attributeField()]))
			),
			characteristics: new fields.SchemaField({
				characteristic1: new fields.StringField({ initial: "" }),
				characteristic2: new fields.StringField({ initial: "" }),
				characteristic3: new fields.StringField({ initial: "" })
			}),
			wounds: new fields.SchemaField({
				wounds: new fields.ArrayField(
					new fields.NumberField({ required: true, nullable: true, initial: 0 }),
					{ initial: Array(WOUND_SLOTS).fill(0) }
				),
				bloodloss: new fields.NumberField({ required: true, nullable: true, initial: 0 }),
				injuries: new fields.StringField({ initial: "" }),
				bleeding: new fields.StringField({ initial: "" }),
				longterm: new fields.StringField({ initial: "" })
			}),
			armour: new fields.SchemaField({
				armour: new fields.StringField({ initial: "" }),
				ar: new fields.NumberField({ required: true, nullable: true, initial: null }),
				penalty: new fields.NumberField({ required: true, nullable: true, initial: null })
			}),
			notes: new fields.StringField({ initial: "" }),
			equipment: new fields.StringField({ initial: "" }),
			languages: new fields.SchemaField({
				lang1: new fields.StringField({ initial: "" }),
				lang2: new fields.StringField({ initial: "" }),
				lang3: new fields.StringField({ initial: "" }),
				lang4: new fields.StringField({ initial: "" })
			}),
			events: new fields.SchemaField({
				supernatural: new fields.StringField({ initial: "" }),
				careers: new fields.SchemaField(
					Object.fromEntries(["c1", "c2", "c3", "c4", "c5", "c6"].map((c) => [c, careerField()]))
				)
			}),
			initiative: new fields.SchemaField({
				modifier: new fields.NumberField({ required: true, nullable: false, initial: 0 })
			}),
			// Persisted so the token resource bar can bind to `hp`, but recomputed
			// from wounds/endurance on every data preparation (SPEC §1.2).
			hp: new fields.SchemaField({
				value: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
				max: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
				wounds: new fields.NumberField({ required: true, nullable: false, initial: 0 })
			})
		};
	}

	/**
	 * Absorb every legacy (Foundry v9-era) shape this system ever persisted.
	 * See z/SPEC.md §7. Must be idempotent.
	 */
	static migrateData(source) {
		// Legacy blank-string numerics → null (NumberField would cast "" to 0)
		source.age = blankToNull(source.age);
		if (source.attributes) {
			for (const key of Object.keys(source.attributes)) {
				const att = source.attributes[key];
				if (!att || typeof att !== "object") continue;
				att.orig = blankToNull(att.orig);
				att.temp = blankToNull(att.temp);
				delete att.test; // declared in v9 types, never used
				delete att.current; // derived; may have been persisted by old form submits
			}
		}
		if (source.armour) {
			source.armour.ar = blankToNull(source.armour.ar);
			source.armour.penalty = blankToNull(source.armour.penalty);
		}

		// wounds.wounds persisted as an object {0: n, 1: n, …} by the old sheet
		if (source.wounds) {
			if (source.wounds.wounds && !Array.isArray(source.wounds.wounds)) {
				source.wounds.wounds = Object.values(source.wounds.wounds);
			}
			if (Array.isArray(source.wounds.wounds)) {
				const w = source.wounds.wounds
					.slice(0, WOUND_SLOTS)
					.map((v) => (Number.isFinite(v) ? v : blankToNull(v)));
				while (w.length < WOUND_SLOTS) w.push(0);
				source.wounds.wounds = w;
			}
			source.wounds.bloodloss = blankToNull(source.wounds.bloodloss);
		}

		// template.json declared the key with a trailing colon; real data may
		// carry either spelling (or a plain string from odd form states).
		const typoLanguages = source["languages:"];
		if (typoLanguages && typeof typoLanguages === "object" && typeof source.languages !== "object") {
			source.languages = typoLanguages;
		}
		if (typeof source.languages !== "object" || source.languages === null) delete source.languages;

		if (source.initiative) {
			const mod = blankToNull(source.initiative.modifier);
			source.initiative.modifier = Number.isFinite(mod) ? mod : 0;
		}

		// Dropped legacy bookkeeping (`version`, `roll`) needs no handling: unknown
		// keys are stripped when the schema initializes.
		return super.migrateData(source);
	}

	/** Derived values — SPEC §1.2. */
	prepareDerivedData() {
		super.prepareDerivedData();

		for (const key of ATTRIBUTES) {
			const att = this.attributes[key];
			if (Number.isFinite(att.temp)) att.current = att.temp;
			else if (Number.isFinite(att.orig)) att.current = att.orig;
			else att.current = 0;
		}

		this.hp.wounds = this.totalWounds;
		this.hp.max = this.attributes.endurance.current + 20;
		this.hp.value = this.hp.max - this.hp.wounds;
	}

	/** Sum of finite, non-zero wound slots (the last slot — bloodloss damage — counts). */
	get totalWounds() {
		return this.wounds.wounds.reduce(
			(total, v) => (v && Number.isFinite(v) ? total + v : total),
			0
		);
	}

	get isUnconscious() {
		return this.hp.wounds > this.attributes.endurance.current;
	}

	get isDead() {
		return this.hp.wounds > this.hp.max;
	}
}
