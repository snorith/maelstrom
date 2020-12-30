import {systemBasePath} from "../../settings"
import {MaelstromAbilityItem} from "../MaelstromAbilityItem"

export class MaelstromAbilityItemSheet extends ItemSheet {
    /**
     * Define default rendering options for the weapon sheet
     * @return {Object}
     */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["boilerplate", "sheet", "item"],
            width: 550,
            height: 620,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "attributes" }]
        });
    }

    /* -------------------------------------------- */
    /*  Rendering                                   */
    /* -------------------------------------------- */

    /**
     * Get the correct HTML template path to use for rendering this particular sheet
     * @type {String}
     */
    get template() {
        return `${systemBasePath}/templates/item/${this.type}Sheet.html`;
    }

    get type() {
        return MaelstromAbilityItem.type;
    }

    /** @override */
    setPosition(options = {}) {
        const position = super.setPosition(options);
        // @ts-ignore
        const sheetBody = this.element.find(".sheet-body")
        const bodyHeight = position.height - 192
        sheetBody?.css("height", bodyHeight)
        return position
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        // Roll handlers, click handlers, etc. would go here.
    }
}
