
import {MaelstromAbilityItem} from "../item/MaelstromAbilityItem"
import {systemBasePath, systemName} from "../settings"
import {MaelstromWeaponItem} from "../item/MaelstromWeaponItem"

/**
 * Higher order function that generates an item creation handler.
 *
 * @param {String} itemType The type of the Item (eg. 'ability', 'weapon', etc.)
 * @param {*} itemClass
 * @param {*} [callback=null]
 * @returns
 */
function onItemCreate(itemType, itemClass, callback = null) {
    return async function(event = null) {
        if (event)
            event.preventDefault();

        const newName = game.i18n.localize(`MAELSTROM.item.${itemType}.new${itemType.capitalize()}`);

        const itemData = {
            name: newName,
            type: itemType,
            data: new itemClass({}),
        };

        const newItem = await this.actor.createOwnedItem(itemData);
        if (callback)
            callback(newItem);

        return newItem;
    }
}

//Sort functions
const sortByOrderFunction = (a, b) => a.data.order < b.data.order ? -1 : a.data.order > b.data.order ? 1 : 0;
const sortByNameFunction = (a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

// Stolen from https://stackoverflow.com/a/34064434/20043
function htmlDecode(input) {
    const doc = new DOMParser().parseFromString(input, "text/html");
    return doc.documentElement.textContent;
}

//Function to remove any HTML markup from eg. item descriptions
function removeHtmlTags(str) {
    // Replace any HTML tag ('<...>') by an empty string
    // and then un-escape any HTML escape codes (eg. &lt;)
    return htmlDecode(str.replace(/<.+?>/gi, ""));
}

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class MaelstromActorSheet extends ActorSheet {

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["boilerplate", "sheet", "actor"],
            width: 925,
            height: 1000,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
        });
    }

    /**
     * Get the correct HTML template path to use for rendering this particular sheet
     * @type {String}
     */
    get template() {
        // 1: Domesday
        // 2: Gothic
        // 3: Rome
        switch (game.settings.get(systemName, "characterSheet"))
        {
            case 1:
            case 2:
            case 3:
                return `${systemBasePath}/templates/actor/actorSheet.html`;
            default:
                throw new Error("Invalid setting for actorSheet template")
        }
    }

    /* -------------------------------------------- */

    /** @override */
    getData() {
        const sheetData = super.getData();
        // @ts-ignore
        sheetData.dtypes = ["String", "Number", "Boolean"];
        // @ts-ignore
        for (let attr of Object.values(sheetData.data.attributes)) {
            // @ts-ignore
            attr.isCheckbox = attr.dtype === "Boolean";
        }

        // Prepare items.
        if (this.actor.data.type == 'character') {
            this._prepareCharacterItems(sheetData);
        }

        return sheetData;
    }

    /**
     * Organize and classify Items for Character sheets.
     *
     * @param sheetData
     * @return {undefined}
     */
    _prepareCharacterItems(sheetData: ActorSheetData) {
        // @ts-ignore
        sheetData.data.items = sheetData.actor.items || {};

        // @ts-ignore
        const items = sheetData.data.items;

        // filter out abilities and sort them
        Object.entries({
            abilities: MaelstromAbilityItem.type
        }).forEach(([val, type]) => {
            // @ts-ignore
            if (!sheetData.data.items[val])
            { // @ts-ignore
                sheetData.data.items[val] = items.filter(i => i.type === type).sort(sortByNameFunction)
            }
        });

        // filter out weapons and sort them
        Object.entries({
            weapons: MaelstromWeaponItem.type
        }).forEach(([val, type]) => {
            // @ts-ignore
            if (!sheetData.data.items[val])
            {   // @ts-ignore
                sheetData.data.items[val] = items.filter(i => i.type === type).sort(sortByOrderFunction)
            }
        })

        // build a list of updates to weapon ordering
        // @ts-ignore
        this._reorderItems(sheetData.data.items.weapons)

        // remove HTML from notes fields
        // @ts-ignore
        // sheetData.data.items.abilities = sheetData.data.items.abilities.map(ability => {
        //     ability.data.notes = removeHtmlTags(ability.data.notes);
        //     return ability;
        // });
    }

    async _reorderItems(items: any[]) {
        let currentOrder = 0

        const updatedItemList = []
        for (let i = 0; i < items.length; i++) {
            // @ts-ignore
            if (items[i].data.order != currentOrder) {
                updatedItemList.push({_id: items[i]._id, 'data.order': currentOrder})
            }
            currentOrder += 5
        }

        if (updatedItemList.length > 0)
            await this.actor.updateEmbeddedEntity("OwnedItem", updatedItemList);
    }

    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        // Add Inventory Item
        html.find('.item-create').click(this._onItemCreate.bind(this));

        // Update Inventory Item
        html.find('.item-edit').click(ev => {
            const td = $(ev.currentTarget).parents(".item");
            const item = this.actor.getOwnedItem(td.data("itemId"));
            item.sheet.render(true);
        });

        // Delete Inventory Item
        html.find('.item-delete').click(ev => {
            if (window.confirm('Delete the item?')) {
                const td = $(ev.currentTarget).parents(".item");
                this.actor.deleteOwnedItem(td.data("itemId"));
                td.slideUp(200, () => this.render(false));
            }
        });

        // Tooltips
        html.find('.tooltip').tooltipster({
            interactive: true
        })

        // Heal all wounds by one
        html.find('.item-heal-wounds').click(this._onItemHealByOne.bind(this))

        // suffer bleeding damage
        html.find('.item-add-bleeding-damage').click(this._onSufferBleedingDamage.bind(this))

        // roll an attibute save roll
        html.find('.attribute-roll').click(this._onAttributeRoll.bind(this))

        // // Rollable abilities.
        // html.find('.rollable').click(this._onRoll.bind(this));
        //
        // // Drag events for macros.
        // if (this.actor.owner) {
        //     let handler = ev => this._onDragItemStart(ev);
        //     html.find('li.item').each((i, li) => {
        //         if (li.classList.contains("inventory-header")) return;
        //         li.setAttribute("draggable", true);
        //         li.addEventListener("dragstart", handler, false);
        //     });
        // }
    }

    _onAttributeRoll(event) {
        event.preventDefault();

        const element = event.currentTarget
        const attribute = element.dataset.attribute

        return this.actor.rollAttribute(attribute)
    }

    /**
     * Each round, the character suffers bloodloss damage equal to the number of bleeding wound that they
     * currently have, this is added to the bloodloss damage wound
     *
     * @param event
     */
    _onSufferBleedingDamage(event) {
        event.preventDefault();

        // @ts-ignore
        const wounds = this.actor.data.data?.wounds?.wounds
        if (wounds) {
            const bleedingWounds = this.actor.data.data?.wounds?.bloodloss as number
            if (Number.isFinite(bleedingWounds) && bleedingWounds > 0) {
                const woundsArray = Object.values(wounds) as number[]           // convert object to an array of values
                if (woundsArray.length < 1)
                    return

                let bloodlossDamage = woundsArray[woundsArray.length - 1]     // get the last entry in the wounds array which is bloodloss damage
                bloodlossDamage = (Number.isFinite(bloodlossDamage)) ? bloodlossDamage + bleedingWounds : bleedingWounds

                woundsArray[woundsArray.length - 1] = bloodlossDamage

                // @ts-ignore
                this.actor.data.data.wounds.wounds = {...woundsArray}
                this.render(false)
            }
        }
    }

    /**
     * Heal all wounds by one
     *
     * @param event
     */
    _onItemHealByOne(event) {
        event.preventDefault();

        // @ts-ignore
        const wounds = this.actor.data.data?.wounds?.wounds
        if (wounds) {
            const woundsArray = Object.values(wounds) as number[]           // convert object to an array of values
            const healed = woundsArray.map(value => {
                if (Number.isFinite(value) && value > 0) {
                    return value - 1
                }
                return 0
            })

            // @ts-ignore
            this.actor.data.data.wounds.wounds = {...healed}
            this.render(false)
        }
    }

    /**
     * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
     * @param {Event} event   The originating click event
     * @private
     */
    _onItemCreate(event) {
        event.preventDefault();

        const element = event.currentTarget;
        // Get the type of item to create.
        const type = element.dataset.type;
        // Grab any data associated with this control.
        const data = duplicate(element.dataset);
        // Initialize a default name.
        const name = `New ${type.capitalize()}`;
        // Prepare the item object.
        const itemData = {
            name: name,
            type: type,
            data: data
        };
        // Remove the type from the dataset since it's in the itemData.type prop.
        delete itemData.data["type"];

        // Finally, create the item!
        return this.actor.createOwnedItem(itemData);
    }

    /**
     * Handle clickable rolls.
     * @param {Event} event   The originating click event
     * @private
     */
    _onRoll(event) {
        event.preventDefault();

        const element = event.currentTarget;
        const dataset = element.dataset;

        if (dataset.roll) {
            let roll = new Roll(dataset.roll, this.actor.data.data);
            let label = dataset.label ? `Rolling ${dataset.label}` : '';
            roll.roll().toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                flavor: label
            });
        }
    }
}
