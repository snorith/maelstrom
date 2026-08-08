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

/**
 * Normalize a legacy blank-string numeric to null so NumberField doesn't cast it
 * to 0 — but ONLY if the key is present. migrateData also runs on update deltas,
 * and assigning an absent key would inject a spurious change (e.g. a wounds-only
 * update silently nulling `age`).
 */
export function normalizeBlank(obj, key) {
	if (obj && typeof obj === "object" && key in obj && (obj[key] === "" || obj[key] === undefined)) {
		obj[key] = null;
	}
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
	 * See z/SPEC.md §7. Must be idempotent, and must be presence-guarded
	 * throughout: this runs on update DELTAS as well as full documents, so
	 * touching a key the delta didn't contain would write a spurious change.
	 */
	static migrateData(source) {
		// Legacy blank-string numerics → null (NumberField would cast "" to 0)
		normalizeBlank(source, "age");
		if (source.attributes) {
			for (const att of Object.values(source.attributes)) {
				if (!att || typeof att !== "object") continue;
				normalizeBlank(att, "orig");
				normalizeBlank(att, "temp");
				delete att.test; // declared in v9 types, never used (delete of an absent key is a no-op)
				delete att.current; // derived; may have been persisted by old form submits
			}
		}
		if (source.armour) {
			normalizeBlank(source.armour, "ar");
			normalizeBlank(source.armour, "penalty");
		}

		// wounds.wounds: persisted as {0: n, 1: n, …} by the old sheet, and form
		// submits arrive the same way. Map by NUMERIC KEY, not Object.values, so a
		// partial object (e.g. a macro updating slot 3 only) cannot shift values
		// into the wrong slots.
		if (source.wounds) {
			if ("wounds" in source.wounds) {
				const w = source.wounds.wounds;
				if (w && typeof w === "object") {
					let arr;
					if (Array.isArray(w)) {
						arr = w.slice(0, WOUND_SLOTS);
						while (arr.length < WOUND_SLOTS) arr.push(0);
					} else {
						arr = Array(WOUND_SLOTS).fill(0);
						for (const [k, v] of Object.entries(w)) {
							const idx = Number(k);
							if (Number.isInteger(idx) && idx >= 0 && idx < WOUND_SLOTS) arr[idx] = v;
						}
					}
					// Blank entries → null; leave anything else for field casting
					source.wounds.wounds = arr.map((v) => (v === "" || v === undefined ? null : v));
				}
			}
			normalizeBlank(source.wounds, "bloodloss");
		}

		// template.json declared the key with a trailing colon; real data may
		// carry either spelling (or a plain string from odd form states).
		const typoLanguages = source["languages:"];
		if (typoLanguages && typeof typoLanguages === "object" && typeof source.languages !== "object") {
			source.languages = typoLanguages;
		}
		if ("languages" in source && (typeof source.languages !== "object" || source.languages === null)) {
			delete source.languages;
		}

		// Blank/null modifier → 0; anything else (including numeric strings) is
		// left for NumberField casting — Number.isFinite("5") is false, so
		// coercing here would destroy legitimate values.
		if (source.initiative && "modifier" in source.initiative) {
			const mod = source.initiative.modifier;
			if (mod === "" || mod === null || mod === undefined) source.initiative.modifier = 0;
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
