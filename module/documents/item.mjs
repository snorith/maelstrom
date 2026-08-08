const TYPE_ICONS = {
	ability: "icons/svg/aura.svg",
	weapon: "icons/svg/combat.svg"
};

export class MaelstromItem extends Item {
	/** Per-type default icons (SPEC §2.1/§2.2). */
	static getDefaultArtwork(itemData) {
		const img = TYPE_ICONS[itemData?.type];
		return img ? { img } : super.getDefaultArtwork(itemData);
	}
}
