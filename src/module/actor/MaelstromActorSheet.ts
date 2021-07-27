
import {MaelstromAbilityItem} from "../item/MaelstromAbilityItem"
import {referenceToGame, systemBasePath, systemName} from "../settings"
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
    return async function(event) {
        if (event)
            event.preventDefault();

		const newName = game.i18n.localize(`MAELSTROM.item.${itemType}.new${itemType.capitalize()}`);

        const itemData = {
            name: newName,
            type: itemType,
            data: new itemClass({}),
        };

        const newItem = await this.actor.createEmbeddedDocuments("Item", [itemData]);
        if (!!callback) {
			// @ts-ignore
			callback(newItem);
		}

		return newItem;
    }
}

//Sort functions
const sortByOrderFunction = (a, b) => a.data.data.order < b.data.data.order ? -1 : a.data.data.order > b.data.data.order ? 1 : 0;
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
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "attributes" }]
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
		//getData behaves MUCH differently in 0.8!
		//see https://gitlab.com/foundrynet/foundryvtt/-/issues/4321
        const sheetData = super.getData();
		//see https://discord.com/channels/170995199584108546/670336275496042502/836066464388743188
		// @ts-ignore
		sheetData.data = sheetData.data.data;

        // @ts-ignore
        sheetData.dtypes = ["String", "Number", "Boolean"];
        // @ts-ignore
        for (let attr of Object.values(sheetData.data.attributes)) {
            // @ts-ignore
            attr.isCheckbox = attr.dtype === "Boolean";
        }

        // Which game flavour are we playing?
		const maelstromFlavour = game.settings.get(systemName, "characterSheet")
		// @ts-ignore
		sheetData.maelstromFlavour = maelstromFlavour

        // Prepare items.
        if (this.actor.data.type == 'character') {
            // @ts-ignore
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
    _prepareCharacterItems(sheetData: ActorSheet.Data) {
        // @ts-ignore
        sheetData.data.items = sheetData.actor.items || {};

        // filter out abilities and sort them
        Object.entries({
            abilities: MaelstromAbilityItem.type
        }).forEach(([val, type]) => {
			if (sheetData.data.items.constructor.name !== "EmbeddedCollection") {
				sheetData.data[val] = sheetData.items.filter(i => i.type === type);
			}
			else {
				sheetData.data[val] = sheetData.data.items.filter(i => i.type === type);
			}

			sheetData.data[val].sort(sortByNameFunction);	// sorts in place

        });

        // filter out weapons and sort them
        Object.entries({
            weapons: MaelstromWeaponItem.type
        }).forEach(([val, type]) => {
			if (sheetData.data.items.constructor.name !== "EmbeddedCollection") {
				sheetData.data[val] = sheetData.items.filter(i => i.type === type);
			}
			else {
				sheetData.data[val] = sheetData.data.items.filter(i => i.type === type);
			}

			sheetData.data[val].sort(sortByOrderFunction);	// sorts in place
        })

        // build a list of updates to weapon ordering
        // @ts-ignore
        this._reorderItems(sheetData.data.weapons)

        // remove HTML from notes fields
        // @ts-ignore
        // sheetData.data.items.abilities = sheetData.data.items.abilities.map(ability => {
        //     ability.data.notes = removeHtmlTags(ability.data.notes);
        //     return ability;
        // });

        sheetData.data.hp.wounds = this.actor._getTotalWounds(sheetData.data)
        // @ts-ignore
        sheetData.data.hp.max = sheetData.data.attributes.endurance.current + 20
        // @ts-ignore
        sheetData.data.hp.value = sheetData.data.hp.max - sheetData.data.hp.wounds
    }

    async _reorderItems(items: any[]) {
        let currentOrder = 0

		// update the order of each item based on the current sort results
        const updatedItemList: any[] = []
        for (let i = 0; i < items.length; i++) {
			updatedItemList.push({_id: items[i].id, 'data.order': currentOrder})
			currentOrder += 5
        }

        // tell each item what the last item's `order` value is
		currentOrder -= 5
		for (let i = 0; i < updatedItemList.length; i++) {
			updatedItemList[i]['data.lastOrder'] = currentOrder
		}

        if (updatedItemList.length > 0)
            await this.actor.updateEmbeddedDocuments("Item", updatedItemList);
    }

    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        // Add Inventory Item
        html.find('.item-create').on("click", this._onItemCreate.bind(this));

        // Update Inventory Item
        html.find('.item-edit').on("click", ev => {
            const td = $(ev.currentTarget).parents(".item");
            const item = this.actor.getEmbeddedDocument("Item", td.data("itemId"));

            // todo: does this work, is sheet on item in v0.8
            // @ts-ignore
			item.sheet.render(true);
        });

        // Delete Inventory Item
        html.find('.item-delete').on("click", ev => {
            if (window.confirm('Delete the item?')) {
                const td = $(ev.currentTarget).parents(".item");
                this.actor.deleteEmbeddedDocuments("Item", [td.data("itemId")]);
                td.slideUp(200, () => this.render(false));
            }
        });

        // Tooltips
        html.find('.tooltip').tooltipster({
            interactive: true
        })

        // Heal all wounds by one
        html.find('.item-heal-wounds').on("click", this._onItemHealByOne.bind(this))

        // suffer bleeding damage
        html.find('.item-add-bleeding-damage').on("click", this._onSufferBleedingDamage.bind(this))

        // roll an attribute saving throw
        html.find('.attribute-roll').on("click", this._onAttributeRoll.bind(this))

        // roll an attribute with a weapon saving throw
        html.find('.weapon-roll').on("click", this._onWeaponItemRoll.bind(this))

        // roll weapon damage
        html.find('.weapon-damage').on("click", this._onWeaponDamageRoll.bind(this))

        // roll initiative
        html.find('.roll-initiative').on("click", this._onRollInitiative.bind(this))

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

    _onRollInitiative(event) {
        event.preventDefault();

        // @ts-ignore
		return this.actor.rollActorInitiative()
    }

    /**
     * Roll a saving throw based on an attribute
     *
     * @param event
     */
    _onAttributeRoll(event) {
        event.preventDefault();

        const element = event.currentTarget
        const attribute = element.dataset.attribute

        // @ts-ignore
		return this.actor.rollAttribute(attribute)
    }

    /**
     * Roll a saving throw based on a weapon/shield item
     *
     * @param event
     */
    _onWeaponItemRoll(event) {
        event.preventDefault();

        const element = event.currentTarget
        const name = element.dataset.name
        const attribute = element.dataset.attribute
        let modifier = element.dataset.modifier

        if (modifier) {
            modifier = Number.parseInt(modifier)
            if (isNaN(modifier))
                modifier = ''
        }

        // @ts-ignore
		return this.actor.rollAttribute(attribute, [modifier], name)
    }

    /**
     * Roll weapon damage
     *
     * @param event
     */
    _onWeaponDamageRoll(event) {
        event.preventDefault();

        const element = event.currentTarget
        const name = element.dataset.name
        const damage = element.dataset.damage

        // @ts-ignore
		return this.actor.rollItemDamage(name, damage)
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
            // @ts-ignore
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
        return this.actor.createEmbeddedDocuments("Item", [itemData]);
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
