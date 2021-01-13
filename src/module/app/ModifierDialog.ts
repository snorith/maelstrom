import {systemBasePath} from "../settings"

export function WaitForModifierDialog(actor: Actor): Promise<any> {
    return new Promise((resolve, reject) => {
        new ModifierDialog(actor, {
            closeFunction: () => resolve(false)
        }).render(true)
    })
}

export class ModifierDialog extends FormApplication {
    /**
     * @inheritDoc
     */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["maelstrom"],
            title: "Modifier",
            template: `${systemBasePath}/templates/dialog/modifier.html`,
            editable: true,
            width: 300,
            height: 200,
        });
    }

    /**
     * @inheritdoc
     */
    constructor(actor, options = {}) {
        const modifierDialogObject = {
            actor,
            modifier: 0
        };

        super(modifierDialogObject, options);
    }

    /**
     * @inheritdoc
     */
    getData() {
        const data = super.getData();

        return mergeObject(data, {
            modifier: this.object.modifier
        });
    }

    /**
     * @inheritdoc
     */
    activateListeners(html) {
        super.activateListeners(html);

        html.find("#apply-modifier").click(this._accept.bind(this))
    }

    /**
     * Event handler for the "Accept" button. Applies the pool changes to the
     * Actor.
     *
     * @memberof RecoveryDialog
     */
    async _accept(event) {
        event.preventDefault()
        event.stopPropagation()

        const dataUpdate = {
            data: {
                roll: {
                    modifier: this.object.modifier
                }
            }
        }

        const actor = this.object.actor as Actor
        await actor.update(dataUpdate).catch(reason => {
            ui.notifications.error("A problem occurred updating the character with the modifier value");
        })

        //await this.close()
        this.submit({})

        this.options.closeFunction()

        return false
    }

    _updateObject(event, formData): Promise<any> {
        let modifier = formData["modifier"]
        modifier = Number.parseInt(modifier)
        if (isNaN(modifier))
            modifier = 0;

        this.object.modifier =  modifier

        //Re-render the form since it's not provided for free in FormApplications
        this.render();

        return new Promise<any>((resolve, reject) => {
            resolve(false)
        }).catch(reason => {
        })
    }
}
