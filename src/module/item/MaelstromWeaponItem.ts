import {referenceToGame} from "../settings"

export type MaelstromWeaponItemType = {
    name: string,
    price: number,
    notes: string,
    as: string,
    ds: string,
    damage: string,
    range: string,
    attributes: {
        attack: string,
        defence: string
    },
    data: any
}

export class MaelstromWeaponItem extends Item {
    static get type() {
        return "weapon";
    }

    prepareData() {
		// @ts-ignore
		if (!this.data.img || this.data.img === this.data.constructor.DEFAULT_ICON)
			// Override common default icon
			this.data.img = 'icons/svg/combat.svg';

        super.prepareData();

        let itemData = this.data as unknown as MaelstromWeaponItemType;
        if (itemData.hasOwnProperty("data"))
            itemData = itemData.data;

		itemData.name = this.data.name || game.i18n.localize("MAELSTROM.item.weapon.newWeapon");
        itemData.notes = itemData.notes || "";

        itemData.as = itemData.as || "";
        itemData.ds = itemData.ds || "";

        itemData.damage = itemData.damage || "";
        itemData.range = itemData.range || "";
        if (!itemData.attributes) {
            itemData.attributes = {
                attack: 'attack',
                defence: 'defence'
            }
        }
        itemData.attributes.attack = itemData.attributes.attack || "attack";
        itemData.attributes.defence = itemData.attributes.defence || "defence";
    }
}
