
export type MaelstromAbilityItemType = {
    name: string,
    price: number,
    notes: string,
    rank: string,
    benefit: string,
    data: any
}

export class MaelstromAbilityItem extends Item {
    static get type() {
        return "ability";
    }

    prepareData() {
        // Override common default icon
        if (!this.data.img) this.data.img = 'icons/svg/lightning.svg';
        super.prepareData();

        let itemData = this.data as unknown as MaelstromAbilityItemType;
        if (itemData.hasOwnProperty("data"))
            itemData = itemData.data;

        itemData.name = this.data.name || game.i18n.localize("MAELSTROM.item.ability.newAbility");
        itemData.notes = itemData.notes || "";

        itemData.rank = itemData.rank || "";
        itemData.benefit = itemData.benefit || "";
    }
}
