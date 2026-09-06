const TYPE_ICONS = {
	ability: "icons/svg/aura.svg",
	weapon: "icons/svg/combat.svg"
};

export class MaelstromItem extends Item {
	/** Journal revisions are append-only through supported document APIs. */
	async _preUpdate(changes, options, user) {
		if (this.getFlag("maelstrom", "woundJournal")) throw new Error("Wound journal revisions are immutable.");
		return super._preUpdate(changes, options, user);
	}

	async _preDelete(options, user) {
		if (this.getFlag("maelstrom", "woundJournal")) throw new Error("Wound journal revisions cannot be deleted individually.");
		return super._preDelete(options, user);
	}

	/** Per-type default icons (SPEC §2.1/§2.2). */
	static getDefaultArtwork(itemData) {
		const img = TYPE_ICONS[itemData?.type];
		return img ? { img } : super.getDefaultArtwork(itemData);
	}
}
